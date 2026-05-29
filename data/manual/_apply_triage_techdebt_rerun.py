"""Apply AI-assisted triage decisions to data/manual/slr_decisions.csv for the
tech-debt shadow rerun.

Mirror of _apply_triage.py (microservices) and _apply_triage_re.py (RE),
applied to the methodology-gate-dropped tech-debt corpus. Final corpus: 45 of
65 auto-included SLRs.

Rubric:
    KEEP if primary subject is TD-as-research-discipline (TD identification,
    management, prioritization, measurement, quantification, SATD detection,
    architectural/requirements TD, tool support, TD in agile/microservices/AI
    intersections that explicitly study TD, etc.) AND the paper is a
    protocol-driven SLR / SMS / MLR.

    DROP if:
      - Primary study (model proposal, framework, survey of practitioners,
        knowledge-base build, multi-method empirical) disguised as systematic
      - Adjacent field where TD is incidental (portfolio mgmt, product mgmt,
        continuous deployment theory, layered arch patterns, quality req mgmt
        broadly, refactoring-in-education, agile startups broadly)
      - Methodology / meta papers (reproducibility, snowballing techniques)
      - Microservices-quality SLR (not TD-focused even though TD touches it)
      - Dataset publication (companion data of another paper already in set)
      - Discussion / position paper masquerading as review

Usage:  python3 data/manual/_apply_triage_techdebt_rerun.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CORPUS_PATH = REPO / "data" / "processed" / "slr_corpus.json"
DECISIONS_PATH = REPO / "data" / "manual" / "slr_decisions.csv"

DROP_INDICES = {
    6, 7, 11, 20, 22, 25, 27, 31, 32, 34, 36, 38, 41, 42, 44, 46, 51, 60, 61, 65,
}


def main() -> None:
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    corpus.sort(key=lambda p: p.get("_paper_key", ""))

    drop_keys: set[str] = set()
    for i, paper in enumerate(corpus, start=1):
        if i in DROP_INDICES:
            drop_keys.add(paper["_paper_key"])

    if len(drop_keys) != len(DROP_INDICES):
        sys.exit(f"Drop key count {len(drop_keys)} != indices {len(DROP_INDICES)} -- corpus order changed?")

    rows = list(csv.DictReader(DECISIONS_PATH.open(encoding="utf-8", newline="")))
    fieldnames = list(rows[0].keys()) if rows else []
    flipped = 0
    for row in rows:
        if row["paper_key"] in drop_keys:
            row["override_verdict"] = "EXCLUDE"
            flipped += 1

    with DECISIONS_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        for row in rows:
            w.writerow(row)

    print(f"Marked {flipped} papers as EXCLUDE (expected {len(DROP_INDICES)})")


if __name__ == "__main__":
    main()
