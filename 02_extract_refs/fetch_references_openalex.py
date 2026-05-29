"""OpenAlex fallback for SLRs that Semantic Scholar can't fetch refs for.

After 02_extract_refs/fetch_references.py runs, some SLRs have zero references
in `slr_refs_outcomes.json` (status="empty" or "cache_hit:empty"). SS's
reference graph has poor coverage for newer or smaller-venue papers, so we
fall back to OpenAlex --- which aggregates from Crossref + MAG + others --- to
recover references for those SLRs.

Workflow:
    1. Read data/processed/slr_corpus.json and slr_refs_outcomes.json
    2. For each SLR whose outcome is empty / cache_hit:empty, look up its
       OpenAlex `Work` by DOI: GET https://api.openalex.org/works/doi:<DOI>
    3. Extract `referenced_works` (OpenAlex IDs)
    4. Batch-resolve those IDs to DOIs via the OpenAlex /works endpoint
    5. Build records compatible with the existing slr_references.json schema
       (paper_key, paperId, title, year, venue, doi, externalIds, citationCount)
    6. Merge into slr_references.json (does NOT overwrite SS-sourced records)
    7. Update slr_refs_outcomes.json with `openalex_ok` / `openalex_empty` /
       `openalex_no_doi` per SLR

Polite pool: requires an email in the `mailto` query param. Read from the
`OPENALEX_EMAIL` env var (fall back to a course-default).

Output: same file as the SS step (data/processed/slr_references.json), so
stage 04 (overlap) doesn't need to know which source provided the refs.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Iterable

import requests
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT  # noqa: E402
from lib.paperid import normalize_doi, paper_key  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"
REFS_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"
OUTCOMES_PATH = REPO_ROOT / "data" / "processed" / "slr_refs_outcomes.json"
OA_CACHE_DIR = REPO_ROOT / "data" / "raw" / "openalex"
OA_CACHE_DIR.mkdir(parents=True, exist_ok=True)

OA_BASE = "https://api.openalex.org/works"
DEFAULT_EMAIL = os.environ.get("OPENALEX_EMAIL", "zhou.jad@northeastern.edu")
HEADERS = {"User-Agent": f"slr-citation-audit (mailto:{DEFAULT_EMAIL})"}

# Treat these stage-02 outcome labels as "needs OpenAlex"
EMPTY_OUTCOMES = {"empty", "cache_hit:empty"}


def _oa_cache_path(key: str) -> Path:
    digest = hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]
    return OA_CACHE_DIR / f"oa_{digest}.json"


def _oa_get(url: str, params: dict | None = None) -> dict | None:
    """GET with cache + polite-pool email. Returns None on 404."""
    params = dict(params or {})
    params.setdefault("mailto", DEFAULT_EMAIL)
    key = url + "?" + "&".join(f"{k}={v}" for k, v in sorted(params.items()) if k != "mailto")
    cache = _oa_cache_path(key)
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    for attempt in range(4):
        resp = requests.get(url, params=params, headers=HEADERS, timeout=30)
        if resp.status_code == 404:
            cache.write_text(json.dumps(None), encoding="utf-8")
            return None
        if resp.status_code == 429:
            wait = 2 ** attempt
            logger.warning("OpenAlex 429; backoff %ds", wait)
            time.sleep(wait)
            continue
        resp.raise_for_status()
        data = resp.json()
        cache.write_text(json.dumps(data), encoding="utf-8")
        return data
    raise RuntimeError(f"OpenAlex retries exhausted: {url}")


def _fetch_slr_record(doi: str) -> dict | None:
    return _oa_get(f"{OA_BASE}/doi:{doi}")


def _resolve_referenced_works(oa_ids: list[str]) -> dict[str, dict]:
    """Batch-resolve OpenAlex work IDs to lightweight metadata.

    Returns {oa_id: {doi, title, year, venue, citationCount}} for each ID
    that OpenAlex knows; missing IDs are silently absent from the result.
    """
    out: dict[str, dict] = {}
    if not oa_ids:
        return out
    # OpenAlex supports up to 100 IDs per filter call; the `|` is the OR
    # separator. We strip the URL prefix so we pass the bare W123 ids.
    bare = [i.rsplit("/", 1)[-1] for i in oa_ids]
    BATCH = 50  # URL length cap; OpenAlex accepts up to 50-100 per filter
    for i in range(0, len(bare), BATCH):
        chunk = bare[i:i + BATCH]
        filter_str = "ids.openalex:" + "|".join(chunk)
        payload = _oa_get(OA_BASE, params={
            "filter": filter_str,
            "per-page": str(len(chunk)),
            "select": "id,doi,title,publication_year,primary_location,cited_by_count",
        })
        if not payload or "results" not in payload:
            continue
        for w in payload["results"]:
            full_id = w.get("id") or ""
            src = ((w.get("primary_location") or {}).get("source") or {})
            out[full_id] = {
                "doi": (w.get("doi") or "").replace("https://doi.org/", "") or None,
                "title": w.get("title"),
                "year": w.get("publication_year"),
                "venue": src.get("display_name"),
                "citationCount": w.get("cited_by_count"),
            }
    return out


def _to_ref_record(oa_id: str, meta: dict) -> dict:
    doi = normalize_doi(meta.get("doi"))
    pseudo = {"doi": doi, "title": meta.get("title")}
    return {
        "paper_key": paper_key(pseudo) if (doi or meta.get("title")) else f"openalex:{oa_id.rsplit('/', 1)[-1]}",
        "paperId": None,
        "title": meta.get("title"),
        "year": meta.get("year"),
        "venue": meta.get("venue"),
        "doi": doi,
        "externalIds": {"DOI": doi} if doi else {},
        "citationCount": meta.get("citationCount"),
        "openAccessPdf": None,
        "_source": "openalex",
        "_openalex_id": oa_id,
    }


def run() -> None:
    if not CORPUS_PATH.exists() or not OUTCOMES_PATH.exists() or not REFS_PATH.exists():
        sys.exit("Run 02_extract_refs/fetch_references.py first; need outcomes + refs.")
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    outcomes: dict[str, str] = json.loads(OUTCOMES_PATH.read_text(encoding="utf-8"))
    refs_by_slr: dict[str, list[dict]] = json.loads(REFS_PATH.read_text(encoding="utf-8"))

    # Target: SLRs whose stage-02 outcome is empty; must have a DOI to query OA
    targets: list[dict] = []
    for slr in corpus:
        key = slr["_paper_key"]
        if outcomes.get(key) not in EMPTY_OUTCOMES:
            continue
        doi = normalize_doi(slr.get("doi") or (slr.get("externalIds") or {}).get("DOI"))
        if not doi:
            outcomes[key] = "openalex_no_doi"
            continue
        targets.append({"key": key, "doi": doi, "slr": slr})

    logger.info("OpenAlex fallback: %d SLRs to query", len(targets))
    recovered = 0
    total_refs = 0
    for t in tqdm(targets, desc="openalex"):
        work = _fetch_slr_record(t["doi"])
        if not work:
            outcomes[t["key"]] = "openalex_404"
            continue
        ref_ids: list[str] = work.get("referenced_works") or []
        if not ref_ids:
            outcomes[t["key"]] = "openalex_empty"
            continue
        meta_by_id = _resolve_referenced_works(ref_ids)
        records = [_to_ref_record(oa_id, meta_by_id[oa_id]) for oa_id in ref_ids if oa_id in meta_by_id]
        refs_by_slr[t["key"]] = records
        outcomes[t["key"]] = f"openalex_ok:{len(records)}"
        recovered += 1
        total_refs += len(records)

    REFS_PATH.write_text(json.dumps(refs_by_slr, indent=2, sort_keys=True), encoding="utf-8")
    OUTCOMES_PATH.write_text(json.dumps(outcomes, indent=2, sort_keys=True), encoding="utf-8")

    from collections import Counter
    tally = Counter(outcomes.values())
    logger.info("OpenAlex recovered refs for %d SLRs (+%d refs)", recovered, total_refs)
    logger.info("Final outcome breakdown: %s", dict(tally))


if __name__ == "__main__":
    run()
