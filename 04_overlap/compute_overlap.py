"""Compute date-controlled citation overlap per SLR.

For each SLR:
    1. Identify its reference set (paper_keys cited by the SLR).
    2. Filter the top-cited corpus to papers published on or before the SLR's
       year (date control — see date_controls.filter_by_year).
    3. Count how many of those eligible top-cited papers appear in the SLR's
       reference set.
    4. Emit a row per SLR with coverage stats and a row per (SLR, missed paper)
       pair for the gap analysis stage.

Inputs:
    data/processed/slr_corpus.json
    data/processed/slr_references.json
    data/processed/top_cited_techdebt.json
Outputs:
    data/processed/overlap_matrix.csv   -- one row per SLR
    data/processed/missed_pairs.csv     -- one row per (SLR, missed paper)
"""
from __future__ import annotations

import csv
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from date_controls import filter_by_year  # noqa: E402

from lib.config import REPO_ROOT  # noqa: E402
from lib.paperid import paper_key  # noqa: E402

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

from lib.config import load as _load
_SUBFIELD = _load().subfield

CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"
REFS_PATH = REPO_ROOT / "data" / "processed" / "slr_references.json"
TOP_CITED_PATH = REPO_ROOT / "data" / "processed" / f"top_cited_{_SUBFIELD}.json"
OVERLAP_MATRIX_PATH = REPO_ROOT / "data" / "processed" / "overlap_matrix.csv"
MISSED_PAIRS_PATH = REPO_ROOT / "data" / "processed" / "missed_pairs.csv"


def _ref_keys(refs: list[dict]) -> set[str]:
    keys: set[str] = set()
    for ref in refs:
        key = ref.get("paper_key") or paper_key(ref)
        if key:
            keys.add(key)
    return keys


def compute(
    corpus: list[dict],
    refs_by_slr: dict[str, list[dict]],
    top_cited: list[dict],
) -> tuple[list[dict], list[dict]]:
    overlap_rows: list[dict] = []
    missed_rows: list[dict] = []

    for slr in corpus:
        slr_key = slr.get("_paper_key") or paper_key(slr)
        slr_year = slr.get("year")
        refs = refs_by_slr.get(slr_key, [])
        ref_keys = _ref_keys(refs)
        eligible = filter_by_year(top_cited, slr_year)
        eligible_keys = {p.get("_paper_key") or paper_key(p): p for p in eligible}

        hits = [p for k, p in eligible_keys.items() if k in ref_keys]
        misses = [p for k, p in eligible_keys.items() if k not in ref_keys]
        eligible_n = len(eligible_keys)
        coverage = (len(hits) / eligible_n) if eligible_n else None

        overlap_rows.append({
            "slr_id": slr_key,
            "slr_title": slr.get("title"),
            "slr_year": slr_year,
            "slr_venue": slr.get("venue"),
            "slr_type": slr.get("_classification_type"),
            "n_refs": len(ref_keys),
            "eligible_top_n": eligible_n,
            "hits": len(hits),
            "misses": len(misses),
            "coverage_pct": round(coverage * 100, 2) if coverage is not None else "",
        })

        for paper in misses:
            missed_rows.append({
                "slr_id": slr_key,
                "slr_year": slr_year,
                "missed_paper_key": paper.get("_paper_key") or paper_key(paper),
                "missed_title": paper.get("title"),
                "missed_year": paper.get("year"),
                "missed_venue": paper.get("venue"),
                "missed_citation_count": paper.get("citationCount"),
                "missed_rank": paper.get("_rank"),
            })

    return overlap_rows, missed_rows


def _write_csv(path: Path, rows: list[dict], fieldnames: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def run(
    corpus_path: Path = CORPUS_PATH,
    refs_path: Path = REFS_PATH,
    top_cited_path: Path = TOP_CITED_PATH,
    overlap_path: Path = OVERLAP_MATRIX_PATH,
    missed_path: Path = MISSED_PAIRS_PATH,
) -> tuple[list[dict], list[dict]]:
    for p in (corpus_path, refs_path, top_cited_path):
        if not p.exists():
            raise FileNotFoundError(f"Missing required input: {p}")

    corpus = json.loads(corpus_path.read_text(encoding="utf-8"))
    refs_by_slr = json.loads(refs_path.read_text(encoding="utf-8"))
    top_cited = json.loads(top_cited_path.read_text(encoding="utf-8"))

    overlap_rows, missed_rows = compute(corpus, refs_by_slr, top_cited)
    _write_csv(overlap_path, overlap_rows, [
        "slr_id", "slr_title", "slr_year", "slr_venue", "slr_type",
        "n_refs", "eligible_top_n", "hits", "misses", "coverage_pct",
    ])
    _write_csv(missed_path, missed_rows, [
        "slr_id", "slr_year",
        "missed_paper_key", "missed_title", "missed_year", "missed_venue",
        "missed_citation_count", "missed_rank",
    ])

    logger.info(
        "Computed overlap for %d SLRs, %d (SLR, missed paper) pairs",
        len(overlap_rows), len(missed_rows),
    )
    return overlap_rows, missed_rows


def main() -> None:
    overlap, missed = run()
    print(f"Wrote {len(overlap)} SLR rows to {OVERLAP_MATRIX_PATH.relative_to(REPO_ROOT)}")
    print(f"Wrote {len(missed)} missed-pair rows to {MISSED_PAIRS_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
