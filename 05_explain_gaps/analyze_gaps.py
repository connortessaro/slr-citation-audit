"""Enrich (SLR, missed top-cited paper) pairs with explanatory features.

Features attached per pair:
    venue_type    -- conference / journal / workshop / preprint / book / unknown
    year_delta    -- SLR year minus paper year (years the paper existed before SLR)
    open_access   -- True/False (has openAccessPdf URL)
    language      -- ISO code or 'en' default; SS rarely exposes — currently 'en'
    in_acm        -- DOI prefix 10.1145 (ACM block)
    in_ieee       -- DOI prefix 10.1109 (IEEE block)
    is_top10      -- True if missed paper is in top-10 of the corpus

Inputs:
    data/processed/missed_pairs.csv
    data/processed/top_cited_techdebt.json
Outputs:
    data/processed/gap_analysis.csv          -- one row per (SLR, missed paper)
    data/processed/gap_summary_by_venue.csv  -- aggregated miss counts by venue type
    data/processed/gap_summary_by_age.csv    -- aggregated miss counts by year-delta bucket
"""
from __future__ import annotations

import csv
import json
import logging
from collections import Counter
from pathlib import Path

import pandas as pd

from lib.config import REPO_ROOT
from lib.paperid import normalize_doi

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

MISSED_PAIRS_PATH = REPO_ROOT / "data" / "processed" / "missed_pairs.csv"
TOP_CITED_PATH = REPO_ROOT / "data" / "processed" / "top_cited_techdebt.json"
OUTPUT_PATH = REPO_ROOT / "data" / "processed" / "gap_analysis.csv"
SUMMARY_VENUE_PATH = REPO_ROOT / "data" / "processed" / "gap_summary_by_venue.csv"
SUMMARY_AGE_PATH = REPO_ROOT / "data" / "processed" / "gap_summary_by_age.csv"


def classify_venue(paper: dict) -> str:
    """Return venue_type from publicationTypes + venue string heuristics."""
    pub_types = paper.get("publicationTypes") or []
    venue = (paper.get("venue") or "").lower()
    title = (paper.get("title") or "").lower()

    if "workshop" in venue or "workshop" in title:
        return "workshop"
    if "arxiv" in venue or "corr" in venue:
        return "preprint"
    if pub_types:
        joined = " ".join(t.lower() for t in pub_types)
        if "journal" in joined:
            return "journal"
        if "conference" in joined:
            return "conference"
        if "book" in joined:
            return "book"
    if "journal" in venue or "transactions" in venue:
        return "journal"
    if "conference" in venue or "symposium" in venue or "proceedings" in venue:
        return "conference"
    return "unknown"


def open_access_flag(paper: dict) -> bool:
    oap = paper.get("openAccessPdf")
    if isinstance(oap, dict):
        return bool(oap.get("url"))
    return bool(oap)


def doi_block(paper: dict) -> tuple[bool, bool]:
    doi = normalize_doi(paper.get("doi") or paper.get("externalIds", {}).get("DOI"))
    if not doi:
        return False, False
    return doi.startswith("10.1145"), doi.startswith("10.1109")


def year_delta(slr_year: int | None, paper_year: int | None) -> int | None:
    if slr_year is None or paper_year is None:
        return None
    try:
        return int(slr_year) - int(paper_year)
    except (TypeError, ValueError):
        return None


def age_bucket(delta: int | None) -> str:
    if delta is None:
        return "unknown"
    if delta < 0:
        return "post-slr"
    if delta <= 2:
        return "0-2y"
    if delta <= 5:
        return "3-5y"
    if delta <= 10:
        return "6-10y"
    return "10y+"


def enrich(missed_rows: list[dict], top_cited: list[dict]) -> list[dict]:
    by_key = {p.get("_paper_key"): p for p in top_cited if p.get("_paper_key")}
    out: list[dict] = []
    for row in missed_rows:
        key = row["missed_paper_key"]
        paper = by_key.get(key, {})
        rank = paper.get("_rank")
        in_acm, in_ieee = doi_block(paper)
        slr_year = int(row["slr_year"]) if row.get("slr_year") not in ("", None) else None
        paper_year = paper.get("year") or (int(row["missed_year"]) if row.get("missed_year") else None)
        delta = year_delta(slr_year, paper_year)
        out.append({
            **row,
            "venue_type": classify_venue(paper),
            "year_delta": delta if delta is not None else "",
            "age_bucket": age_bucket(delta),
            "open_access": open_access_flag(paper),
            "language": "en",
            "in_acm": in_acm,
            "in_ieee": in_ieee,
            "is_top10": rank is not None and rank <= 10,
        })
    return out


def _read_missed(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def _summaries(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    if not rows:
        return [], []
    df = pd.DataFrame(rows)
    by_venue = (
        df.groupby("venue_type")
        .size()
        .reset_index(name="missed_count")
        .sort_values("missed_count", ascending=False)
        .to_dict(orient="records")
    )
    by_age = (
        df.groupby("age_bucket")
        .size()
        .reset_index(name="missed_count")
        .sort_values("missed_count", ascending=False)
        .to_dict(orient="records")
    )
    return by_venue, by_age


def run(
    missed_pairs_path: Path = MISSED_PAIRS_PATH,
    top_cited_path: Path = TOP_CITED_PATH,
    output_path: Path = OUTPUT_PATH,
    summary_venue_path: Path = SUMMARY_VENUE_PATH,
    summary_age_path: Path = SUMMARY_AGE_PATH,
) -> list[dict]:
    if not missed_pairs_path.exists():
        raise FileNotFoundError(f"Missing input: {missed_pairs_path}. Run compute_overlap first.")
    if not top_cited_path.exists():
        raise FileNotFoundError(f"Missing input: {top_cited_path}. Run fetch_top_cited first.")

    missed = _read_missed(missed_pairs_path)
    top_cited = json.loads(top_cited_path.read_text(encoding="utf-8"))
    enriched = enrich(missed, top_cited)

    base_fields = list(missed[0].keys()) if missed else [
        "slr_id", "slr_year",
        "missed_paper_key", "missed_title", "missed_year", "missed_venue",
        "missed_citation_count", "missed_rank",
    ]
    extra_fields = [
        "venue_type", "year_delta", "age_bucket", "open_access", "language",
        "in_acm", "in_ieee", "is_top10",
    ]
    _write_csv(output_path, enriched, base_fields + extra_fields)

    by_venue, by_age = _summaries(enriched)
    _write_csv(summary_venue_path, by_venue, ["venue_type", "missed_count"])
    _write_csv(summary_age_path, by_age, ["age_bucket", "missed_count"])

    counts = Counter(r["venue_type"] for r in enriched)
    logger.info("Enriched %d gaps; venue mix: %s", len(enriched), dict(counts))
    return enriched


def main() -> None:
    rows = run()
    print(f"Wrote {len(rows)} enriched gaps to {OUTPUT_PATH.relative_to(REPO_ROOT)}")
    print(f"Venue summary: {SUMMARY_VENUE_PATH.relative_to(REPO_ROOT)}")
    print(f"Age summary: {SUMMARY_AGE_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
