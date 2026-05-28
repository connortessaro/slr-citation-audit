"""Classify SLR candidates for a single source (ACM/SS/IEEE).

This is the "siloed" replacement for `merge_and_classify.py`. Each dataset is
kept independent to preserve provenance.

Inputs:
    data/raw/<source>/slr_candidates.json   (preferred)
    data/raw/*_slr_candidates.json          (legacy fallback)

Outputs:
    data/manual/<source>/slr_decisions.csv
    data/processed/<source>/slr_corpus.json
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
from pathlib import Path
from typing import Iterable

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import dedup_by_key, paper_key
from lib.paths import Source, SourcePaths

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

#
# NOTE (2026-05-28): We intentionally do NOT require "methodology signal" terms
# (PRISMA/Kitchenham/etc.) in the abstract. Many legitimate SLR/SMS abstracts
# omit protocol vocabulary; requiring it drastically reduces recall.
#


def _classify(
    paper: dict,
    keywords: list[str],
    slr_patterns: list[str],
    year_min: int,
    year_max: int,
) -> tuple[str, str, str | None]:
    """Return (verdict, reason, paper_type or None)."""
    title = (paper.get("title") or "").lower()
    abstract = (paper.get("abstract") or "").lower()
    text = f"{title} {abstract}"

    if not any(k in text for k in keywords):
        return "EXCLUDE", "subfield keywords not in title or abstract", None

    if not any(p in title for p in slr_patterns):
        # Allow self-label in abstract only if abstract is present and clear.
        if not any(p in abstract for p in slr_patterns):
            return "EXCLUDE", "no SLR/SMS self-label in title or abstract", None

    year = paper.get("year")
    if year is None or not (year_min <= year <= year_max):
        return "EXCLUDE", f"year {year} outside [{year_min},{year_max}]", None

    paper_type = "sms" if "mapping" in title else "slr"
    return "INCLUDE", "SLR/SMS self-label + subfield fit", paper_type


def _load_existing_overrides(path: Path) -> dict[str, str]:
    overrides: dict[str, str] = {}
    if not path.exists():
        return overrides
    with path.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if "override_verdict" not in (reader.fieldnames or []):
            return overrides
        for row in reader:
            if row.get("override_verdict"):
                overrides[row["paper_key"]] = row["override_verdict"]
    return overrides


def _write_decisions(path: Path, rows: Iterable[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "paper_key",
        "title",
        "year",
        "venue",
        "source",
        "verdict",
        "reason",
        "type",
        "override_verdict",
    ]
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def run(*, source: Source, candidates_path: Path | None = None) -> list[dict]:
    cfg = load_config()
    sp = SourcePaths(source)

    in_path = candidates_path or sp.candidates_in
    if not in_path.exists():
        raise FileNotFoundError(
            f"Missing candidates for source={source!r}: {in_path}. "
            "Run the relevant search script first."
        )

    overrides = _load_existing_overrides(sp.decisions)
    candidates = json.loads(in_path.read_text(encoding="utf-8"))
    if not isinstance(candidates, list):
        raise ValueError(f"Expected JSON array in {in_path}")

    for p in candidates:
        p.setdefault("source", source)

    unique = dedup_by_key(candidates)
    logger.info("%s candidates: %d raw -> %d unique", source.upper(), len(candidates), len(unique))

    keywords_lower = [k.lower() for k in cfg.keywords]
    slr_patterns_lower = [p.lower() for p in cfg.slr_title_patterns]

    decision_rows: list[dict] = []
    included: list[dict] = []
    for paper in unique:
        key = paper_key(paper)
        verdict, reason, ptype = _classify(paper, keywords_lower, slr_patterns_lower, cfg.year_min, cfg.year_max)
        if key in overrides:
            original = verdict
            verdict = overrides[key]
            reason = f"manual override; original auto verdict was {original}"

        decision_rows.append(
            {
                "paper_key": key,
                "title": paper.get("title"),
                "year": paper.get("year"),
                "venue": paper.get("venue"),
                "source": paper.get("source"),
                "verdict": verdict,
                "reason": reason,
                "type": ptype or "",
                "override_verdict": overrides.get(key, ""),
            }
        )
        if verdict == "INCLUDE":
            paper["_classification_type"] = ptype
            paper["_paper_key"] = key
            included.append(paper)

    _write_decisions(sp.decisions, decision_rows)

    sp.corpus.parent.mkdir(parents=True, exist_ok=True)
    sp.corpus.write_text(json.dumps(included, indent=2, sort_keys=True), encoding="utf-8")

    n_inc = sum(1 for r in decision_rows if r["verdict"] == "INCLUDE")
    n_exc = sum(1 for r in decision_rows if r["verdict"] == "EXCLUDE")
    logger.info("%s decisions: %d INCLUDE, %d EXCLUDE", source.upper(), n_inc, n_exc)
    return included


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify SLR candidates for a single source.")
    parser.add_argument("--source", required=True, choices=["acm", "ss", "ieee"])
    parser.add_argument(
        "--candidates",
        type=Path,
        default=None,
        help="Override input candidates JSON path (default: data/raw/<source>/slr_candidates.json, with legacy fallback).",
    )
    return parser.parse_args()


def main() -> None:
    args = _parse_args()
    included = run(source=args.source, candidates_path=args.candidates)
    sp = SourcePaths(args.source)
    print(f"Wrote {len(included)} SLRs to {sp.corpus.relative_to(REPO_ROOT)}")
    print(f"Audit trail: {sp.decisions.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()

