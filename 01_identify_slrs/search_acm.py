"""Parse ACM Digital Library BibTeX exports into candidate JSON.

ACM has no free public API. Workflow:
    1. Run keyword search on https://dl.acm.org with `query=<keyword> AND
       systematic literature review` (replicate for each keyword/pattern).
    2. Export results as BibTeX → save into `data/raw/acm_exports/`.
    3. Run this script to parse + emit unified JSON.

Output: data/raw/acm_slr_candidates.json
"""
from __future__ import annotations

import json
import logging
import re
import sys
from pathlib import Path
from typing import Iterable

import bibtexparser

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import dedup_by_key  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

ACM_EXPORTS_DIR = REPO_ROOT / "data" / "raw" / "acm_exports"
OUTPUT_PATH = REPO_ROOT / "data" / "raw" / "acm_slr_candidates.json"

_YEAR_PATTERN = re.compile(r"\b(19|20)\d{2}\b")


def _entry_to_paper(entry: dict) -> dict:
    doi = entry.get("doi") or _extract_doi_from_url(entry.get("url"))
    year_match = _YEAR_PATTERN.search(entry.get("year", "") or "")
    return {
        "paperId": None,
        "title": (entry.get("title") or "").strip().strip("{}"),
        "abstract": entry.get("abstract"),
        "year": int(year_match.group(0)) if year_match else None,
        "venue": entry.get("booktitle") or entry.get("journal"),
        "externalIds": {"DOI": doi} if doi else {},
        "doi": doi,
        "authors": entry.get("author"),
        "source": "acm",
        "raw_bibtex_key": entry.get("ID"),
    }


def _extract_doi_from_url(url: str | None) -> str | None:
    if not url:
        return None
    match = re.search(r"10\.\d{4,9}/[^\s\"]+", url)
    return match.group(0) if match else None


def _read_exports(paths: Iterable[Path]) -> list[dict]:
    out: list[dict] = []
    for path in paths:
        logger.info("Parsing %s", path)
        with path.open("r", encoding="utf-8") as f:
            db = bibtexparser.load(f)
        out.extend(_entry_to_paper(e) for e in db.entries)
    return out


def run() -> list[dict]:
    cfg = load_config()
    ACM_EXPORTS_DIR.mkdir(parents=True, exist_ok=True)
    bibs = sorted(ACM_EXPORTS_DIR.glob("*.bib"))
    if not bibs:
        logger.warning(
            "No .bib exports found in %s. See module docstring for export workflow.",
            ACM_EXPORTS_DIR,
        )
        unique: list[dict] = []
    else:
        raw = _read_exports(bibs)
        # Subfield safety net: keep only entries whose title or abstract
        # mentions one of the configured keywords.
        keyword_lower = [k.lower() for k in cfg.keywords]
        filtered = [
            p for p in raw
            if any(k in ((p.get("title") or "") + " " + (p.get("abstract") or "")).lower() for k in keyword_lower)
        ]
        unique = dedup_by_key(filtered)
        logger.info("ACM: %d entries, %d after subfield filter, %d unique", len(raw), len(filtered), len(unique))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(unique, indent=2, sort_keys=True), encoding="utf-8")
    return unique


def main() -> None:
    papers = run()
    print(f"Wrote {len(papers)} ACM candidates to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
