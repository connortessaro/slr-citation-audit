"""Fetch full reference list for each SLR via Semantic Scholar.

For each SLR in the corpus:
    1. Resolve its Semantic Scholar paperId (from raw record or by DOI lookup).
    2. Pull its reference list (cited papers).
    3. Cache the raw response at data/raw/refs/{slr_key}.json (resume-on-failure).
    4. After all SLRs are processed, merge into data/processed/slr_references.json
       keyed by paper_key.

Input: data/processed/<source>/slr_corpus.json
Output:
    data/raw/<source>/refs/<slr_key>.json   -- per-SLR cache (auditable)
    data/processed/<source>/slr_references.json -- {slr_key: [{paper_key, title, year, doi, ...}]}
"""
from __future__ import annotations

import argparse
import json
import logging
import re
from pathlib import Path

from tqdm import tqdm

from lib.config import REPO_ROOT
from lib.paperid import normalize_doi, paper_key
from lib.paths import Source, SourcePaths
from lib.ss_client import SSClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"  # legacy default
REFS_CACHE_DIR = REPO_ROOT / "data" / "raw" / "refs"  # legacy default
OUTPUT_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"  # legacy default

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
    external_ids = cited.get("externalIds") or {}
    return {
        "paper_key": paper_key(cited),
        "paperId": cited.get("paperId"),
        "title": cited.get("title"),
        "year": cited.get("year"),
        "venue": cited.get("venue"),
        "doi": normalize_doi(cited.get("doi") or external_ids.get("DOI")),
        "externalIds": external_ids,
        "citationCount": cited.get("citationCount"),
        "openAccessPdf": cited.get("openAccessPdf"),
    }


def _fetch_one(client: SSClient, slr: dict, *, cache_dir: Path) -> list[dict] | None:
    key = slr.get("_paper_key") or paper_key(slr)
    cache_path = cache_dir / f"{_safe_filename(key)}.json"
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
        # If SS cannot provide a reference graph for this paper, keep the SLR in the
        # output with an empty reference list so downstream stages remain stable.
        if isinstance(exc, TypeError) and "NoneType" in str(exc) and "iterable" in str(exc):
            logger.warning("References unavailable via SS for %s (%s): %s", key, paper_id, exc)
            raw_refs = []
        else:
            logger.error("Failed to fetch refs for %s (%s): %s", key, paper_id, exc)
            return None

    # Semantic Scholar can legitimately return no references for some papers.
    # Treat that as an empty list (still cache it) rather than skipping the SLR.
    if raw_refs is None:
        raw_refs = []

    normalised = [r for r in (_normalise_reference(r) for r in raw_refs) if r is not None]
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(normalised, indent=2, sort_keys=True), encoding="utf-8")
    return normalised


def run(
    corpus_path: Path = CORPUS_PATH,
    output_path: Path = OUTPUT_PATH,
    *,
    cache_dir: Path = REFS_CACHE_DIR,
) -> dict[str, list[dict]]:
    if not corpus_path.exists():
        raise FileNotFoundError(
            f"Corpus missing: {corpus_path}. Run 01_identify_slrs/classify_slrs.py first (per source)."
        )
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    client = SSClient.from_config()

    out: dict[str, list[dict]] = {}
    for slr in tqdm(corpus, desc="fetch refs"):
        key = slr.get("_paper_key") or paper_key(slr)
        refs = _fetch_one(client, slr, cache_dir=cache_dir)
        if refs is None:
            continue
        out[key] = refs

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(out, indent=2, sort_keys=True), encoding="utf-8")

    n_refs = sum(len(v) for v in out.values())
    logger.info("Fetched refs for %d/%d SLRs, %d total references", len(out), len(corpus), n_refs)
    return out


def main() -> None:
    parser = argparse.ArgumentParser(description="Fetch reference lists for each SLR via Semantic Scholar.")
    parser.add_argument("--source", choices=["acm", "ss", "ieee"], default=None)
    parser.add_argument("--corpus", type=Path, default=None, help="Override input corpus path.")
    parser.add_argument("--out", type=Path, default=None, help="Override output JSON path.")
    args = parser.parse_args()

    corpus_path = args.corpus
    out_path = args.out
    cache_dir = REFS_CACHE_DIR
    if args.source:
        sp = SourcePaths(args.source)  # type: ignore[arg-type]
        corpus_path = corpus_path or sp.corpus
        out_path = out_path or sp.refs_out
        cache_dir = sp.refs_cache

    refs_by_slr = run(
        corpus_path=corpus_path or CORPUS_PATH,
        output_path=out_path or OUTPUT_PATH,
        cache_dir=cache_dir,
    )
    out_print = out_path or OUTPUT_PATH
    print(f"Wrote references for {len(refs_by_slr)} SLRs to {out_print.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
