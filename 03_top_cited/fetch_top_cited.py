"""Identify the top-N most-cited papers in the configured subfield.

The Semantic Scholar API does not directly support "sort by citations" on
keyword search, so we pull a wide net per keyword, deduplicate, filter to the
subfield, then rank locally by citationCount.

Outputs:
    data/processed/top_cited_<subfield>.json         -- top N (default 50)
    data/processed/top_cited_<subfield>_top100.json  -- top 100 for robustness
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from lib.config import REPO_ROOT, load as load_config  # noqa: E402
from lib.paperid import dedup_by_key, paper_key  # noqa: E402
from lib.ss_client import SSClient  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_SUBFIELD = load_config().subfield
OUTPUT_PATH = REPO_ROOT / "data" / "processed" / f"top_cited_{_SUBFIELD}.json"
ROBUSTNESS_PATH = REPO_ROOT / "data" / "processed" / f"top_cited_{_SUBFIELD}_top100.json"

FIELDS = (
    "paperId",
    "title",
    "abstract",
    "year",
    "venue",
    "publicationVenue",
    "publicationTypes",
    "externalIds",
    "citationCount",
    "openAccessPdf",
)
WIDE_LIMIT = 1000


def _subfield_match(paper: dict, keywords: list[str]) -> bool:
    text = ((paper.get("title") or "") + " " + (paper.get("abstract") or "")).lower()
    return any(k in text for k in keywords)


def run(top_n: int | None = None, robustness_n: int = 100) -> list[dict]:
    cfg = load_config()
    target_n = top_n or cfg.top_n
    client = SSClient.from_config()
    year_range = f"{cfg.year_min}-{cfg.year_max}"

    pooled: list[dict] = []
    for keyword in cfg.keywords:
        logger.info("Top-cited search: %r year=%s", keyword, year_range)
        # lib hard-caps page size at 100; max_results bounds total materialised.
        hits = client.search_papers(
            keyword,
            year=year_range,
            limit=100,
            fields=FIELDS,
            bulk=True,
            max_results=WIDE_LIMIT,
        )
        pooled.extend(hits)

    unique = dedup_by_key(pooled)
    keywords_lower = [k.lower() for k in cfg.keywords]
    in_subfield = [p for p in unique if _subfield_match(p, keywords_lower)]

    ranked = sorted(
        in_subfield,
        key=lambda p: (p.get("citationCount") or 0),
        reverse=True,
    )
    for rank, paper in enumerate(ranked, start=1):
        paper["_rank"] = rank
        paper["_paper_key"] = paper_key(paper)

    top = ranked[:target_n]
    robustness = ranked[:robustness_n]

    logger.info(
        "Top-cited: pooled=%d, unique=%d, in-subfield=%d -> top%d + top%d",
        len(pooled), len(unique), len(in_subfield), target_n, robustness_n,
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(top, indent=2, sort_keys=True), encoding="utf-8")
    ROBUSTNESS_PATH.write_text(json.dumps(robustness, indent=2, sort_keys=True), encoding="utf-8")
    return top


def main() -> None:
    top = run()
    print(f"Wrote {len(top)} top-cited papers to {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    if top:
        print("\nPreview (top 5):")
        for paper in top[:5]:
            cites = paper.get("citationCount") or 0
            print(f"  {paper.get('_rank'):3d}  [{cites:5d}] {paper.get('year'):4d}  {paper.get('title')}")


if __name__ == "__main__":
    main()
