"""Search Semantic Scholar for SLR candidates in the configured subfield.

Strategy:
    1. Issue a keyword search for each configured keyword (joined with the SLR
       title patterns) to keep result volume tractable.
    2. Additionally do a broad keyword-only search and prefilter results by
       title pattern, to catch papers whose SLR self-label sits in the abstract
       rather than the title.
    3. Merge + dedup by paper_key.

Output: data/raw/ss_slr_candidates.json
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import dedup_by_key  # noqa: E402
from lib.ss_client import SSClient  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

OUTPUT_PATH = REPO_ROOT / "data" / "raw" / "ss_slr_candidates.json"

FIELDS = (
    "paperId",
    "title",
    "abstract",
    "year",
    "venue",
    "externalIds",
    "citationCount",
    "openAccessPdf",
    "publicationVenue",
    "publicationTypes",
)


def _title_matches_slr(title: str | None, patterns: list[str]) -> bool:
    if not title:
        return False
    lower = title.lower()
    return any(p in lower for p in patterns)


def run() -> list[dict]:
    cfg = load_config()
    client = SSClient.from_config()
    year_range = f"{cfg.year_min}-{cfg.year_max}"
    candidates: list[dict] = []

    # Targeted: keyword + SLR phrase
    for keyword in cfg.keywords:
        for pattern in cfg.slr_title_patterns:
            query = f"{keyword} {pattern}"
            logger.info("SS targeted search: %r year=%s", query, year_range)
            hits = client.search_papers(query, year=year_range, limit=100, fields=FIELDS)
            candidates.extend(hits)

    # Broad: keyword only, then title-pattern prefilter
    for keyword in cfg.keywords:
        logger.info("SS broad search: %r year=%s", keyword, year_range)
        hits = client.search_papers(keyword, year=year_range, limit=100, fields=FIELDS)
        candidates.extend(h for h in hits if _title_matches_slr(h.get("title"), cfg.slr_title_patterns))

    unique = dedup_by_key(candidates)
    logger.info("SS candidates: %d raw -> %d unique", len(candidates), len(unique))

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(unique, indent=2, sort_keys=True), encoding="utf-8")
    return unique


def main() -> None:
    papers = run()
    print(f"Wrote {len(papers)} candidates to {OUTPUT_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
