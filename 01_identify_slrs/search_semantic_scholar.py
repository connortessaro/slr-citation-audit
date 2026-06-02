"""Search Semantic Scholar for SLR candidates in the configured subfield.

Strategy:
    1. Issue a keyword search for each configured keyword (joined with the SLR
       title patterns) to keep result volume tractable.
    2. Additionally do a broad keyword-only search and prefilter results by
       title pattern, to catch papers whose SLR self-label sits in the abstract
       rather than the title.
    3. Merge + dedup by paper_key.

Output: data/raw/ss_slr_candidates.json

Preview (fewer API calls, sample output):
    PYTHONPATH=. python 01_identify_slrs/search_semantic_scholar.py \\
        --max-searches 1 --limit 5 --preview
"""
from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path
from typing import Iterator

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import dedup_by_key
from lib.paths import candidates_output_path, candidates_preview_output_path
from lib.slr_labels import matches_review_label
from lib.ss_client import SSClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

OUTPUT_PATH = candidates_output_path("ss")
PREVIEW_OUTPUT_PATH = candidates_preview_output_path("ss")

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


def planned_searches(keywords: list[str], slr_patterns: list[str]) -> list[tuple[str, str]]:
    """Return (kind, query) pairs in execution order. kind is 'targeted' or 'broad'."""
    out: list[tuple[str, str]] = []
    for keyword in keywords:
        for pattern in slr_patterns:
            out.append(("targeted", f"{keyword} {pattern}"))
    for keyword in keywords:
        out.append(("broad", keyword))
    return out


def _iter_searches(
    keywords: list[str],
    slr_patterns: list[str],
    *,
    max_searches: int | None,
) -> Iterator[tuple[str, str]]:
    for i, item in enumerate(planned_searches(keywords, slr_patterns)):
        if max_searches is not None and i >= max_searches:
            logger.info("Stopping after %d search(es) (--max-searches)", max_searches)
            return
        yield item


def _preview_papers(papers: list[dict], n: int = 3) -> None:
    sample = papers[:n]
    print("\n--- Sample return (first %d paper(s)) ---\n" % len(sample))
    print(json.dumps(sample, indent=2, sort_keys=True))
    print("\n--- end sample ---\n")


def _load_existing_candidates(path: Path) -> list[dict]:
    if not path.exists():
        return []
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array in {path}")
    return data


def run(
    *,
    max_searches: int | None = None,
    limit_per_search: int = 100,
    preview: bool = False,
    output_path: Path | None = None,
    append: bool = False,
) -> list[dict]:
    cfg = load_config()
    client = SSClient.from_config()
    year_range = f"{cfg.year_min}-{cfg.year_max}"
    if output_path is None:
        output_path = PREVIEW_OUTPUT_PATH if max_searches is not None else OUTPUT_PATH

    existing: list[dict] = []
    if append:
        existing = _load_existing_candidates(output_path)
        if existing:
            logger.info(
                "Append mode: loaded %d existing candidates from %s",
                len(existing),
                output_path.relative_to(REPO_ROOT),
            )

    candidates: list[dict] = []
    slr_patterns_lower = [p.lower() for p in cfg.slr_title_patterns]

    total_planned = len(planned_searches(cfg.keywords, cfg.slr_title_patterns))
    if max_searches is not None:
        logger.info(
            "Capped run: up to %d of %d planned searches, limit=%d per search",
            max_searches,
            total_planned,
            limit_per_search,
        )

    for kind, query in _iter_searches(cfg.keywords, cfg.slr_title_patterns, max_searches=max_searches):
        if kind == "targeted":
            logger.info("SS targeted search: %r year=%s", query, year_range)
            hits = client.search_papers(query, year=year_range, limit=limit_per_search, fields=FIELDS)
            for h in hits:
                h.setdefault("source", "ss")
            candidates.extend(hits)
        else:
            logger.info("SS broad search: %r year=%s", query, year_range)
            hits = client.search_papers(query, year=year_range, limit=limit_per_search, fields=FIELDS)
            for h in hits:
                h.setdefault("source", "ss")
            candidates.extend(
                h
                for h in hits
                if matches_review_label(h.get("title"), None, slr_patterns_lower)
            )

    fetched_unique = dedup_by_key(candidates)
    logger.info("SS fetch: %d raw -> %d unique this run", len(candidates), len(fetched_unique))

    merged = dedup_by_key(existing + fetched_unique) if existing else fetched_unique
    if existing:
        logger.info(
            "After append + dedup: %d existing + %d fetched -> %d unique",
            len(existing),
            len(fetched_unique),
            len(merged),
        )

    if preview and merged:
        _preview_papers(merged)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(json.dumps(merged, indent=2, sort_keys=True), encoding="utf-8")
    return merged


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Search Semantic Scholar for SLR candidates.",
    )
    parser.add_argument(
        "--max-searches",
        type=int,
        default=None,
        metavar="N",
        help="Run at most N API searches (default: all keyword×pattern targeted + keyword broad searches).",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        metavar="N",
        help="Max papers per search request (default: 100). Use a small value (e.g. 5) for previews.",
    )
    parser.add_argument(
        "--preview",
        action="store_true",
        help="Print a JSON sample of results to stdout.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=None,
        help="Override output JSON path (default: ss_slr_candidates.json, or .preview.json when capped).",
    )
    parser.add_argument(
        "--append",
        action="store_true",
        help="Merge results with existing output file (dedupe by paper_key). "
        "Use when widening year range or adding searches without discarding prior candidates.",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    if args.limit < 1:
        raise SystemExit("--limit must be >= 1")
    if args.max_searches is not None and args.max_searches < 1:
        raise SystemExit("--max-searches must be >= 1")

    papers = run(
        max_searches=args.max_searches,
        limit_per_search=args.limit,
        preview=args.preview,
        output_path=args.output,
        append=args.append,
    )
    out = args.output
    if out is None:
        out = PREVIEW_OUTPUT_PATH if args.max_searches is not None else OUTPUT_PATH
    print(f"Wrote {len(papers)} candidates to {out.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
