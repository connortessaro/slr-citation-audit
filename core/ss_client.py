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

import requests
from ratelimit import limits, sleep_and_retry
from semanticscholar import SemanticScholar
from semanticscholar.SemanticScholarException import GatewayTimeoutException, ServerErrorException

from core.config import REPO_ROOT, load as load_config

logger = logging.getLogger(__name__)

CACHE_DIR = REPO_ROOT / "data" / "raw" / "ss_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

# Authenticated: 1 req / sec sustained. We enforce 1 RPS to reduce 429s and
# keep runs deterministic.
_RATE_CALLS = 1
_RATE_PERIOD = 1

_GRAPH_BASE = "https://api.semanticscholar.org/graph/v1"


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
        self._api_key = api_key
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
    ) -> list[dict]:
        """Bulk keyword search, returns list of paper dicts.

        The SS API allows at most 100 results per request; relevance search
        caps offset+limit at 1000 total. Limits above 100 are satisfied by
        paginating through ``PaginatedResults``.
        """
        if limit < 1:
            raise ValueError("limit must be >= 1")
        max_results = min(limit, 1000)
        cache = _cache_key(
            "search",
            {"q": query, "year": year, "limit": max_results, "fields": sorted(fields or [])},
        )
        cached = _read_cache(cache)
        if cached is not None:
            return cached
        page_limit = min(max_results, 100)
        results = self._call(
            self._client.search_paper,
            query,
            year=year,
            limit=page_limit,
            fields=list(fields) if fields else None,
        )
        papers: list[dict] = []
        for paper in results:
            papers.append(_as_dict(paper))
            if len(papers) >= max_results:
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
        """Return full reference list (paginated under the hood by the lib)."""
        cache = _cache_key(f"refs_{paper_id.replace(':', '_')}", {"fields": sorted(fields or [])})
        cached = _read_cache(cache)
        if cached is not None:
            return cached
        try:
            refs = self._call(self._client.get_paper_references, paper_id, fields=list(fields) if fields else None)
        except TypeError as exc:
            # Fallback: call Graph API directly and parse JSON safely.
            # This avoids upstream SDK crashes when the API returns null list fields.
            logger.warning("SS SDK references failed for %s (%s); falling back to Graph API", paper_id, exc)
            out = self._get_references_via_graph_api(paper_id, fields=list(fields) if fields else None)
            _write_cache(cache, out)
            return out
        # The upstream client can return None when no references exist (or are hidden).
        # Treat as empty list so downstream stages can still proceed deterministically.
        if refs is None:
            out: list[dict] = []
        else:
            out = [_as_dict(r) for r in refs]
        _write_cache(cache, out)
        return out

    def _get_references_via_graph_api(self, paper_id: str, fields: list[str] | None) -> list[dict]:
        """Direct Graph API fallback for /paper/{id}/references.

        Returns a list of reference records in the same shape used elsewhere
        ({citedPaper: {...}, ...}) so downstream normalisation logic remains unchanged.
        """
        headers: dict[str, str] = {}
        if self._api_key:
            headers["x-api-key"] = self._api_key

        # Graph API returns a paginated object containing `data`.
        # Some papers return `data: null` when references are unavailable; treat as empty.
        out: list[dict] = []
        offset = 0
        limit = 100
        while True:
            _rate_limited_marker()
            params = {
                "fields": ",".join(fields) if fields else None,
                "offset": offset,
                "limit": limit,
            }
            # Remove None params so requests doesn't send "fields=None"
            params = {k: v for k, v in params.items() if v is not None}

            url = f"{_GRAPH_BASE}/paper/{paper_id}/references"
            resp = requests.get(url, headers=headers, params=params, timeout=30)
            if resp.status_code == 429:
                retry_after = resp.headers.get("Retry-After")
                sleep_s = float(retry_after) if retry_after else 5.0
                logger.warning("SS 429 for %s; sleeping %.1fs then retry", paper_id, sleep_s)
                time.sleep(sleep_s)
                continue
            resp.raise_for_status()
            payload = resp.json()
            data = payload.get("data")
            if not data:
                break
            if not isinstance(data, list):
                logger.warning("Unexpected references payload for %s: data is %s", paper_id, type(data).__name__)
                break
            out.extend(data)
            if len(data) < limit:
                break
            offset += len(data)
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

