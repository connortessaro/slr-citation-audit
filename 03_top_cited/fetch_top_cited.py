"""Identify the top-N most-cited papers in the configured subfield.

Uses a two-pass benchmark (Semantic Scholar citation counts):

1. **Established** — papers old enough to have accumulated citations (year ≤ as_of − recent_years),
   ranked by ``citationCount``, take half of top_n (default 25 of 50).
2. **Recent** — papers from the last ``recent_years`` calendar years, same ranking, take the other half.

The union forms the primary corpus so the benchmark reflects both historical influence and
current momentum. Pass membership is stored on each record as ``_pass`` (``established`` /
``recent``). If one pass cannot fill its quota, the other pass's surplus candidates backfill.

Discovery: wide keyword search (limit = 1,000 per keyword), dedupe, subfield filter, then
local ranking (SS search does not support sort-by-citations).

Outputs:
    data/processed/top_cited_techdebt.json         -- top N (default 50)
    data/processed/top_cited_techdebt_top100.json  -- robustness (same two-pass, N=100)
    data/processed/top_cited_techdebt_meta.json    -- pass sizes, cutoff year, pool stats
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import dedup_by_key, paper_key
from lib.ss_client import SSClient

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

OUTPUT_PATH = REPO_ROOT / "data" / "processed" / "top_cited_techdebt.json"
ROBUSTNESS_PATH = REPO_ROOT / "data" / "processed" / "top_cited_techdebt_top100.json"
META_PATH = REPO_ROOT / "data" / "processed" / "top_cited_techdebt_meta.json"

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


def _paper_year(paper: dict) -> int | None:
    year = paper.get("year")
    if year is None:
        return None
    try:
        return int(year)
    except (TypeError, ValueError):
        return None


def cutoff_year(as_of_year: int, recent_years: int) -> int:
    """Last publication year counted as *established* (inclusive)."""
    return as_of_year - recent_years


def split_established_recent(
    papers: list[dict],
    as_of_year: int,
    recent_years: int,
) -> tuple[list[dict], list[dict]]:
    """Partition pool by age relative to ``as_of_year``."""
    cut = cutoff_year(as_of_year, recent_years)
    established: list[dict] = []
    recent: list[dict] = []
    for paper in papers:
        year = _paper_year(paper)
        if year is None:
            continue
        if year <= cut:
            established.append(paper)
        else:
            recent.append(paper)
    return established, recent


def rank_by_citations(papers: list[dict]) -> list[dict]:
    return sorted(papers, key=lambda p: (p.get("citationCount") or 0), reverse=True)


def _copy_paper(paper: dict) -> dict:
    """Shallow copy so multiple two-pass runs do not share ``_rank`` / ``_pass`` fields."""
    return dict(paper)


def _take_quota(
    ranked: list[dict],
    quota: int,
    seen_keys: set[str],
) -> list[dict]:
    selected: list[dict] = []
    for paper in ranked:
        if len(selected) >= quota:
            break
        key = paper_key(paper)
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        selected.append(_copy_paper(paper))
    return selected


def two_pass_select(
    pool: list[dict],
    top_n: int,
    as_of_year: int,
    recent_years: int,
) -> tuple[list[dict], dict[str, Any]]:
    """Build top-N via established + recent passes (Semantic Scholar citationCount)."""
    established_pool, recent_pool = split_established_recent(pool, as_of_year, recent_years)
    est_ranked = rank_by_citations(established_pool)
    rec_ranked = rank_by_citations(recent_pool)

    est_quota = (top_n + 1) // 2
    rec_quota = top_n // 2
    seen: set[str] = set()

    est_selected = _take_quota(est_ranked, est_quota, seen)
    rec_selected = _take_quota(rec_ranked, rec_quota, seen)

    for rank, paper in enumerate(est_selected, start=1):
        paper["_pass"] = "established"
        paper["_pass_rank"] = rank
    for rank, paper in enumerate(rec_selected, start=1):
        paper["_pass"] = "recent"
        paper["_pass_rank"] = rank

    combined = est_selected + rec_selected
    if len(combined) < top_n:
        for paper in rank_by_citations(pool):
            if len(combined) >= top_n:
                break
            key = paper_key(paper)
            if not key or key in seen:
                continue
            seen.add(key)
            copy = _copy_paper(paper)
            copy["_pass"] = "backfill"
            copy["_pass_rank"] = len(combined) + 1
            combined.append(copy)

    for rank, paper in enumerate(combined, start=1):
        paper["_rank"] = rank
        paper["_paper_key"] = paper_key(paper)

    cut = cutoff_year(as_of_year, recent_years)
    est_keys = {paper_key(p) for p in est_selected}
    rec_keys = {paper_key(p) for p in rec_selected}
    meta: dict[str, Any] = {
        "method": "two_pass_citation_count",
        "citation_source": "semantic_scholar",
        "as_of_year": as_of_year,
        "recent_years": recent_years,
        "cutoff_year_inclusive_established": cut,
        "top_n": top_n,
        "established_quota": est_quota,
        "recent_quota": rec_quota,
        "pool_size": len(pool),
        "established_pool_size": len(established_pool),
        "recent_pool_size": len(recent_pool),
        "established_selected": len(est_selected),
        "recent_selected": len(rec_selected),
        "backfill_count": sum(1 for p in combined if p.get("_pass") == "backfill"),
        "pass_overlap_count": len(est_keys & rec_keys),
    }
    return combined, meta


def fetch_pool(client: SSClient, cfg) -> list[dict]:
    year_range = f"{cfg.year_min}-{cfg.year_max}"
    pooled: list[dict] = []
    for keyword in cfg.keywords:
        logger.info("Top-cited search: %r year=%s", keyword, year_range)
        hits = client.search_papers(keyword, year=year_range, limit=WIDE_LIMIT, fields=FIELDS)
        pooled.extend(hits)

    unique = dedup_by_key(pooled)
    keywords_lower = [k.lower() for k in cfg.keywords]
    in_subfield = [p for p in unique if _subfield_match(p, keywords_lower)]
    logger.info(
        "Top-cited pool: pooled=%d, unique=%d, in-subfield=%d",
        len(pooled),
        len(unique),
        len(in_subfield),
    )
    return in_subfield


def run(top_n: int | None = None, robustness_n: int | None = None) -> list[dict]:
    cfg = load_config()
    target_n = top_n or cfg.top_n
    robustness = robustness_n if robustness_n is not None else cfg.top_cited_robustness_n
    as_of = cfg.top_cited_as_of_year
    recent_years = cfg.top_cited_recent_years

    client = SSClient.from_config()
    pool = fetch_pool(client, cfg)

    top, top_meta = two_pass_select(pool, target_n, as_of, recent_years)
    robust, robust_meta = two_pass_select(pool, robustness, as_of, recent_years)

    meta = {
        "primary": top_meta,
        "robustness": robust_meta,
    }

    logger.info(
        "Top-cited two-pass: as_of=%d recent_years=%d cutoff<=%d | "
        "top%d (est=%d rec=%d) + top%d (est=%d rec=%d)",
        as_of,
        recent_years,
        top_meta["cutoff_year_inclusive_established"],
        target_n,
        top_meta["established_selected"],
        top_meta["recent_selected"],
        robustness,
        robust_meta["established_selected"],
        robust_meta["recent_selected"],
    )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(top, indent=2, sort_keys=True), encoding="utf-8")
    ROBUSTNESS_PATH.write_text(json.dumps(robust, indent=2, sort_keys=True), encoding="utf-8")
    META_PATH.write_text(json.dumps(meta, indent=2, sort_keys=True), encoding="utf-8")
    return top


def main() -> None:
    top = run()
    print(f"Wrote {len(top)} top-cited papers to {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    if META_PATH.exists():
        meta = json.loads(META_PATH.read_text(encoding="utf-8"))
        pm = meta["primary"]
        print(
            f"Two-pass (as_of={pm['as_of_year']}, recent_years={pm['recent_years']}): "
            f"established={pm['established_selected']} recent={pm['recent_selected']} "
            f"(cutoff year ≤ {pm['cutoff_year_inclusive_established']})"
        )
    if top:
        print("\nPreview (top 5):")
        for paper in top[:5]:
            cites = paper.get("citationCount") or 0
            ppass = paper.get("_pass", "?")
            print(
                f"  {paper.get('_rank'):3d}  [{cites:5d}] {paper.get('year'):4d}  "
                f"{ppass:12s}  {paper.get('title')}"
            )


if __name__ == "__main__":
    main()
