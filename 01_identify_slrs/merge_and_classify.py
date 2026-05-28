"""Merge SS/ACM/IEEE candidate lists, dedup, classify SLR vs survey.

Classification follows `data/manual/CLASSIFICATION.md`. Each candidate gets an
automated verdict + reason. Decisions are persisted to
`data/manual/slr_decisions.csv`; any pre-existing row in that file with an
`override_verdict` column overrides the automated decision (this is the
"manual override" hook — but no human review is expected for this project).

Outputs:
    data/manual/slr_decisions.csv  -- audit trail (one row per candidate)
    data/processed/slr_corpus.json -- included papers only

NOTE: The pipeline has moved to a per-source ("siloed") architecture.
Prefer `01_identify_slrs/classify_slrs.py --source {acm,ss,ieee}` which writes to
`data/processed/<source>/...` and `data/manual/<source>/...`.
"""
from __future__ import annotations

import csv
import json
import logging
from pathlib import Path
from typing import Iterable

from lib.config import REPO_ROOT, load as load_config
from lib.paperid import dedup_by_key, paper_key

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

CANDIDATE_PATHS = {
    "semanticscholar": REPO_ROOT / "data" / "raw" / "ss_slr_candidates.json",
    "acm": REPO_ROOT / "data" / "raw" / "acm_slr_candidates.json",
    "ieee": REPO_ROOT / "data" / "raw" / "ieee_slr_candidates.json",
}
DECISIONS_PATH = REPO_ROOT / "data" / "manual" / "slr_decisions.csv"
CORPUS_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus.json"

# Protocol-language signals distinct from the SLR self-label (which is checked
# separately). Picked from Kitchenham/PRISMA-style methodology vocabulary.
METHOD_KEYWORDS = (
    "prisma",
    "kitchenham",
    "search string",
    "inclusion criteria",
    "exclusion criteria",
    "databases were searched",
    "search protocol",
    "primary studies",
    "research questions",
    "snowballing",
)


def _load_source(path: Path, source: str) -> list[dict]:
    if not path.exists():
        logger.warning("Missing %s; skipping", path)
        return []
    papers = json.loads(path.read_text(encoding="utf-8"))
    for p in papers:
        p.setdefault("source", source)
    return papers


def _classify(paper: dict, keywords: list[str], slr_patterns: list[str], year_min: int, year_max: int) -> tuple[str, str, str | None]:
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

    has_methodology_signal = any(k in text for k in METHOD_KEYWORDS)
    if not has_methodology_signal:
        return "EXCLUDE", "no methodology/protocol signal in abstract", None

    paper_type = "sms" if "mapping" in title else "slr"
    return "INCLUDE", "SLR/SMS self-label + methodology signal + subfield fit", paper_type


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


def _write_decisions(rows: Iterable[dict]) -> None:
    DECISIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = [
        "paper_key", "title", "year", "venue", "source",
        "verdict", "reason", "type", "override_verdict",
    ]
    with DECISIONS_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({k: row.get(k, "") for k in fieldnames})


def run() -> list[dict]:
    cfg = load_config()
    overrides = _load_existing_overrides(DECISIONS_PATH)

    all_candidates: list[dict] = []
    for source, path in CANDIDATE_PATHS.items():
        all_candidates.extend(_load_source(path, source))

    unique = dedup_by_key(all_candidates)
    logger.info("Candidates: %d raw -> %d unique", len(all_candidates), len(unique))

    keywords_lower = [k.lower() for k in cfg.keywords]
    slr_patterns_lower = [p.lower() for p in cfg.slr_title_patterns]

    decision_rows: list[dict] = []
    included: list[dict] = []
    for paper in unique:
        key = paper_key(paper)
        verdict, reason, ptype = _classify(paper, keywords_lower, slr_patterns_lower, cfg.year_min, cfg.year_max)
        if key in overrides:
            verdict = overrides[key]
            reason = f"manual override; original auto verdict was {verdict}"
        decision_rows.append({
            "paper_key": key,
            "title": paper.get("title"),
            "year": paper.get("year"),
            "venue": paper.get("venue"),
            "source": paper.get("source"),
            "verdict": verdict,
            "reason": reason,
            "type": ptype or "",
            "override_verdict": overrides.get(key, ""),
        })
        if verdict == "INCLUDE":
            paper["_classification_type"] = ptype
            paper["_paper_key"] = key
            included.append(paper)

    _write_decisions(decision_rows)

    CORPUS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CORPUS_PATH.write_text(json.dumps(included, indent=2, sort_keys=True), encoding="utf-8")

    n_inc = sum(1 for r in decision_rows if r["verdict"] == "INCLUDE")
    n_exc = sum(1 for r in decision_rows if r["verdict"] == "EXCLUDE")
    logger.info("Decisions: %d INCLUDE, %d EXCLUDE", n_inc, n_exc)
    return included


def main() -> None:
    included = run()
    print(f"Wrote {len(included)} SLRs to {CORPUS_PATH.relative_to(REPO_ROOT)}")
    print(f"Audit trail: {DECISIONS_PATH.relative_to(REPO_ROOT)}")


if __name__ == "__main__":
    main()
