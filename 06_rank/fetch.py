"""Fetch enrichment data for stage 06_rank: abstracts, authors, OA PDF text.

For every unique paper across SLRs + refs + top-cited:
    1. Pull abstract + authors via Semantic Scholar `get_paper` (cached).
    2. If `openAccessPdf.url` present and FULLTEXT_ENABLED, download PDF and
       extract text via pymupdf. Cache extracted text to data/raw/fulltext/.

Inputs:
    data/processed/slr_corpus.json
    data/processed/slr_references.json
    data/processed/top_cited_techdebt.json
Outputs:
    data/processed/paper_metadata.json   -- {paper_key: enriched record}
    data/raw/fulltext/<safe_key>.txt     -- extracted PDF text (per paper)
"""
from __future__ import annotations

import json
import logging
import sys
from io import BytesIO
from pathlib import Path

import requests
from tqdm import tqdm

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import paper_key, safe_filename  # noqa: E402
from lib.ss_client import SSClient  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"
REFS_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"
TOP_CITED_PATH = REPO_ROOT / "data" / "processed" / "top_cited_techdebt.json"
METADATA_PATH = REPO_ROOT / "data" / "processed" / "paper_metadata.json"
FULLTEXT_DIR = REPO_ROOT / "data" / "raw" / "fulltext"

ENRICH_FIELDS = (
    "paperId",
    "title",
    "abstract",
    "authors",
    "venue",
    "year",
    "citationCount",
    "externalIds",
    "openAccessPdf",
)

_HTTP_HEADERS = {"User-Agent": "slr-citation-audit/0.1 (research)"}
_PDF_TIMEOUT = 30


def _resolve_paper_id(paper: dict) -> str | None:
    """Return an SS-usable identifier: paperId or DOI:..., else None."""
    pid = paper.get("paperId") or paper.get("_paperId")
    if pid:
        return pid
    ext = paper.get("externalIds") or {}
    doi = paper.get("doi") or ext.get("DOI")
    if doi:
        return f"DOI:{doi}"
    return None


def _collect_unique_papers(
    corpus: list[dict],
    refs_by_slr: dict[str, list[dict]],
    top_cited: list[dict],
) -> dict[str, dict]:
    """Index all papers by paper_key. Later sources don't overwrite earlier hits."""
    out: dict[str, dict] = {}
    for slr in corpus:
        key = slr.get("_paper_key") or paper_key(slr)
        out.setdefault(key, slr)
    for refs in refs_by_slr.values():
        for ref in refs:
            key = ref.get("paper_key") or paper_key(ref)
            out.setdefault(key, ref)
    for paper in top_cited:
        key = paper.get("_paper_key") or paper_key(paper)
        out.setdefault(key, paper)
    return out


def _enrich_one(client: SSClient, paper: dict) -> dict:
    """Fetch abstract+authors+OA PDF URL from SS. Falls back to input on failure."""
    paper_id = _resolve_paper_id(paper)
    if not paper_id:
        return paper
    try:
        fresh = client.get_paper(paper_id, fields=ENRICH_FIELDS)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Failed to enrich %s: %s", paper_id, exc)
        return paper
    # Merge: prefer fresh non-null values over the seed record.
    merged = dict(paper)
    for k, v in (fresh or {}).items():
        if v is not None and v != "":
            merged[k] = v
    return merged


def _download_fulltext(url: str) -> str | None:
    """Download PDF + extract text via pymupdf. Returns None on any failure."""
    try:
        import pymupdf  # noqa: PLC0415 -- optional heavy dep, defer import
    except ImportError:
        logger.error("pymupdf not installed; install requirements.txt")
        return None

    try:
        resp = requests.get(url, headers=_HTTP_HEADERS, timeout=_PDF_TIMEOUT, stream=False)
        resp.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        logger.debug("PDF download failed (%s): %s", url, exc)
        return None

    try:
        with pymupdf.open(stream=BytesIO(resp.content), filetype="pdf") as doc:
            return "\n".join(page.get_text() for page in doc)
    except Exception as exc:  # noqa: BLE001
        logger.debug("PDF parse failed (%s): %s", url, exc)
        return None


def _maybe_fetch_fulltext(key: str, paper: dict, enabled: bool) -> str | None:
    """Returns extracted text (cached if previously fetched). None if unavailable."""
    if not enabled:
        return None
    cache = FULLTEXT_DIR / f"{safe_filename(key)}.txt"
    if cache.exists():
        return cache.read_text(encoding="utf-8")
    oa = paper.get("openAccessPdf") or {}
    url = oa.get("url") if isinstance(oa, dict) else None
    if not url:
        return None
    text = _download_fulltext(url)
    if not text:
        return None
    FULLTEXT_DIR.mkdir(parents=True, exist_ok=True)
    cache.write_text(text, encoding="utf-8")
    return text


def run(
    corpus_path: Path = CORPUS_PATH,
    refs_path: Path = REFS_PATH,
    top_cited_path: Path = TOP_CITED_PATH,
    output_path: Path = METADATA_PATH,
) -> dict[str, dict]:
    for p in (corpus_path, refs_path, top_cited_path):
        if not p.exists():
            raise FileNotFoundError(f"Missing required input: {p}")

    cfg = load_config()
    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    refs_by_slr = json.loads(refs_path.read_text(encoding="utf-8"))
    top_cited = json.loads(top_cited_path.read_text(encoding="utf-8"))

    unique = _collect_unique_papers(corpus, refs_by_slr, top_cited)
    logger.info("Collected %d unique papers across corpus/refs/top-cited", len(unique))

    client = SSClient.from_config()
    n_fulltext = 0
    enriched: dict[str, dict] = {}
    for key, paper in tqdm(unique.items(), desc="enrich"):
        merged = _enrich_one(client, paper)
        text = _maybe_fetch_fulltext(key, merged, cfg.fulltext_enabled)
        merged["_paper_key"] = key
        merged["_has_fulltext"] = text is not None
        if text is not None:
            n_fulltext += 1
        enriched[key] = merged

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(enriched, indent=2, sort_keys=True), encoding="utf-8")
    logger.info(
        "Wrote metadata for %d papers (%d with full text) to %s",
        len(enriched), n_fulltext, output_path.relative_to(REPO_ROOT),
    )
    return enriched


def main() -> None:
    enriched = run()
    n_abstracts = sum(1 for p in enriched.values() if p.get("abstract"))
    n_fulltext = sum(1 for p in enriched.values() if p.get("_has_fulltext"))
    print(f"Enriched {len(enriched)} papers — {n_abstracts} have abstracts, {n_fulltext} have full text")


if __name__ == "__main__":
    main()
