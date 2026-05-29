"""Semantic Scholar client wrapper with persistent JSON cache + rate limiting.

Wraps the `semanticscholar` package. All calls cache to data/raw/ss_cache/ so
re-runs don't re-hit the API. Cache invalidated only by file deletion.
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from pathlib import Path
from typing import Any, Iterable

from ratelimit import limits, sleep_and_retry
from semanticscholar import SemanticScholar
from semanticscholar.SemanticScholarException import (
    GatewayTimeoutException,
    ServerErrorException,
)

from .config import REPO_ROOT, load as load_config

logger = logging.getLogger(__name__)

CACHE_DIR = REPO_ROOT / "data" / "raw" / "ss_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Public limits: 100 req / 5 min. Authenticated: 1 req / sec sustained.
_RATE_CALLS = 80
_RATE_PERIOD = 60


def _cache_key(namespace: str, payload: dict[str, Any]) -> Path:
    blob = json.dumps(payload, sort_keys=True).encode("utf-8")
    digest = hashlib.sha1(blob).hexdigest()[:16]
    return CACHE_DIR / f"{namespace}_{digest}.json"


def _read_cache(path: Path) -> Any | None:
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("Corrupt cache at %s; refetching", path)
    return None


def _write_cache(path: Path, value: Any) -> None:
    path.write_text(json.dumps(value, indent=2, sort_keys=True), encoding="utf-8")


@sleep_and_retry
@limits(calls=_RATE_CALLS, period=_RATE_PERIOD)
def _rate_limited_marker() -> None:
    return None


class SSClient:
    """Thin wrapper. Use a single instance per pipeline run."""

    def __init__(self, api_key: str | None = None, retries: int = 3, backoff: float = 2.0):
        self._client = SemanticScholar(api_key=api_key) if api_key else SemanticScholar()
        self._retries = retries
        self._backoff = backoff

    @classmethod
    def from_config(cls) -> "SSClient":
        cfg = load_config()
        return cls(api_key=cfg.ss_api_key)

    def _call(self, fn, *args, **kwargs):
        delay = self._backoff
        last_exc: Exception | None = None
        for attempt in range(self._retries):
            _rate_limited_marker()
            try:
                return fn(*args, **kwargs)
            except (GatewayTimeoutException, ServerErrorException) as exc:
                last_exc = exc
                logger.warning("SS transient error (%s); attempt %d", exc, attempt + 1)
                time.sleep(delay)
                delay *= 2
        assert last_exc is not None
        raise last_exc

    def search_papers(
        self,
        query: str,
        year: str | None = None,
        limit: int = 100,
        fields: Iterable[str] | None = None,
        bulk: bool = False,
        max_results: int | None = None,
    ) -> list[dict]:
        """Keyword search, returns list of paper dicts.

        - `bulk=True` uses the `/paper/search/bulk` endpoint (up to 1000 results
          per request, no pagination cost) when supported by the library.
        - `max_results` caps how many results we materialize from the lib's
          paginator — important because broad queries (e.g. "technical debt")
          would otherwise enumerate thousands of pages at 1 RPS.
        """
        cache_key_payload = {
            "q": query,
            "year": year,
            "limit": limit,
            "fields": sorted(fields or []),
            "bulk": bulk,
            "max_results": max_results,
        }
        cache = _cache_key("search", cache_key_payload)
        cached = _read_cache(cache)
        if cached is not None:
            return cached
        call_kwargs: dict[str, Any] = {
            "query": query,
            "year": year,
            "limit": limit,
            "fields": list(fields) if fields else None,
        }
        if bulk:
            call_kwargs["bulk"] = True
        results = self._call(self._client.search_paper, **call_kwargs)
        papers: list[dict] = []
        for paper in results:
            papers.append(_as_dict(paper))
            if max_results is not None and len(papers) >= max_results:
                break
        _write_cache(cache, papers)
        return papers

    def get_paper(self, paper_id: str, fields: Iterable[str] | None = None) -> dict:
        cache = _cache_key(f"paper_{paper_id.replace(':', '_')}", {"fields": sorted(fields or [])})
        cached = _read_cache(cache)
        if cached is not None:
            return cached
        paper = self._call(self._client.get_paper, paper_id, fields=list(fields) if fields else None)
        result = _as_dict(paper)
        _write_cache(cache, result)
        return result

    def get_references(self, paper_id: str, fields: Iterable[str] | None = None) -> list[dict]:
        """Return full reference list (paginated under the hood by the lib).

        Note: when SS has zero references indexed for a paper, the `data` field
        of the SS response comes back as null. The `semanticscholar` lib's
        eager-load in `PaginatedResults.create()` then runs
        `for item in results['data']` and raises `TypeError: 'NoneType' object
        is not iterable`. Treat that as an empty result rather than a hard
        failure — the paper simply has no refs in SS's index.
        """
        cache = _cache_key(f"refs_{paper_id.replace(':', '_')}", {"fields": sorted(fields or [])})
        cached = _read_cache(cache)
        if cached is not None:
            return cached
        try:
            refs = self._call(self._client.get_paper_references, paper_id, fields=list(fields) if fields else None)
        except TypeError as exc:
            logger.info("SS has no references indexed for %s (%s); treating as empty", paper_id, exc)
            refs = None
        out = [_as_dict(r) for r in refs] if refs is not None else []
        _write_cache(cache, out)
        return out


def _as_dict(obj: Any) -> dict:
    """Best-effort conversion of a `semanticscholar` model into a plain dict."""
    if isinstance(obj, dict):
        return obj
    if hasattr(obj, "raw_data") and obj.raw_data is not None:
        return obj.raw_data
    if hasattr(obj, "__dict__"):
        return {k: v for k, v in vars(obj).items() if not k.startswith("_")}
    return {"value": obj}
