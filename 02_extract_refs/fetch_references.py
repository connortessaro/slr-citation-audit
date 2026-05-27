"""Fetch full reference list for each SLR via Semantic Scholar.

For each SLR in the corpus:
    1. Resolve its Semantic Scholar paperId (from raw record or by DOI lookup).
    2. Pull its reference list (cited papers).
    3. Cache the raw response at data/raw/refs/{slr_key}.json (resume-on-failure).
    4. After all SLRs are processed, merge into data/processed/slr_references.json
       keyed by paper_key.

Input: data/processed/slr_corpus.json
Output:
    data/raw/refs/<slr_key>.json   -- per-SLR cache (auditable)
    data/processed/slr_references.json -- {slr_key: [{paper_key, title, year, doi, ...}]}
"""
from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path

from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT  # noqa: E402
from lib.paperid import normalize_doi, paper_key  # noqa: E402
from lib.ss_client import SSClient  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"
REFS_CACHE_DIR = REPO_ROOT / "data" / "raw" / "refs"
OUTPUT_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"

REF_FIELDS = (
    "paperId",
    "title",
    "year",
    "venue",
    "externalIds",
    "citationCount",
    "openAccessPdf",
)

_KEY_FS_SAFE = re.compile(r"[^a-zA-Z0-9._-]+")


def _safe_filename(key: str) -> str:
    return _KEY_FS_SAFE.sub("_", key)[:200]


def _resolve_paper_id(slr: dict) -> str | None:
    """Return an identifier usable with the SS API.

    Priority: existing paperId → DOI prefixed for SS → None (caller must skip).
    """
    pid = slr.get("paperId")
    if pid:
        return pid
    doi = normalize_doi(slr.get("doi") or slr.get("externalIds", {}).get("DOI"))
    if doi:
        return f"DOI:{doi}"
    return None


def _normalise_reference(ref_record: dict) -> dict | None:
    """Each `get_paper_references` row looks like {citedPaper: {...}, ...}."""
    if "citedPaper" in ref_record:
        cited = ref_record.get("citedPaper")
    else:
        cited = ref_record
    if not cited:
        return None
    return {
        "paper_key": paper_key(cited),
        "paperId": cited.get("paperId"),
        "title": cited.get("title"),
        "year": cited.get("year"),
        "venue": cited.get("venue"),
        "doi": normalize_doi(cited.get("doi") or cited.get("externalIds", {}).get("DOI")),
        "externalIds": cited.get("externalIds", {}),
        "citationCount": cited.get("citationCount"),
        "openAccessPdf": cited.get("openAccessPdf"),
    }


def _fetch_one(client: SSClient, slr: dict) -> list[dict] | None:
    key = slr.get("_paper_key") or paper_key(slr)
    cache_path = REFS_CACHE_DIR / f"{_safe_filename(key)}.json"
    if cache_path.exists():
        try:
            return json.loads(cache_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logger.warning("Corrupt cache at %s; refetching", cache_path)

    paper_id = _resolve_paper_id(slr)
    if not paper_id:
        logger.warning("SLR %s has no paperId/DOI; skipping", key)
        return None

    try:
        raw_refs = client.get_references(paper_id, fields=REF_FIELDS)
    except Exception as exc:
        logger.error("Failed to fetch refs for %s (%s): %s", key, paper_id, exc)
        return None

    normalised = [r for r in (_normalise_reference(r) for r in raw_refs) if r is not None]
    REFS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(normalised, indent=2, sort_keys=True), encoding="utf-8")
    return normalised


def run(corpus_path: Path = CORPUS_PATH, output_path: Path = OUTPUT_PATH) -> dict[str, list[dict]]:
    if not corpus_path.exists():
        raise FileNotFoundError(f"Corpus missing: {corpus_path}. Run merge_and_classify.py first.")
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    client = SSClient.from_config()

    out: dict[str, list[dict]] = {}
    for slr in tqdm(corpus, desc="fetch refs"):
        key = slr.get("_paper_key") or paper_key(slr)
        refs = _fetch_one(client, slr)
        if refs is None:
            continue
        out[key] = refs

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(out, indent=2, sort_keys=True), encoding="utf-8")

    n_refs = sum(len(v) for v in out.values())
    logger.info("Fetched refs for %d/%d SLRs, %d total references", len(out), len(corpus), n_refs)
    return out


def main() -> None:
    refs_by_slr = run()
    print(f"Wrote references for {len(refs_by_slr)} SLRs to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
