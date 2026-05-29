"""Apply AI-assisted triage decisions to data/manual/slr_decisions.csv for RE.

Mirror of _apply_triage.py (microservices), with RE-specific DROP_INDICES.

Rubric used:
    KEEP if primary subject is RE-as-research-discipline (elicitation,
    prioritization, traceability, NFRs, RE-for-{AI,IoT,embedded,...},
    education, process improvement, agile RE, etc.) AND the paper is a
    protocol-driven SLR / SMS / MLR / tertiary review.

    DROP if:
      - Primary study (case study, model proposal, framework, experiment,
        empirical investigation) disguised by "systematic review" wording
      - Adjacent field where RE is incidental (BPM, KM, testing, refactoring,
        SBSE, general-SE surveys, product management, AAL/IoT/healthcare
        applications, etc.)
      - Replicated authors/titles (thesis + journal versions of same work)
      - Editorials, prefaces, datasets, experience reports, agendas
      - Domain-specific SLRs that just happen to elicit requirements for X
        (hospital dashboards, mobile interventions, food donation, etc.)

Usage:  python3 data/manual/_apply_triage_re.py
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CORPUS_PATH = REPO / "data" / "processed" / "slr_corpus.json"
DECISIONS_PATH = REPO / "data" / "manual" / "slr_decisions.csv"

# 1-based indices of DROP decisions when the corpus is sorted by _paper_key asc.
DROP_INDICES = {
    4, 5, 12, 19, 29, 34, 37, 42, 47, 48, 55, 56, 57, 59, 65, 69, 75, 76, 78,
    79, 83, 84, 85, 89, 91, 109, 110, 116, 118, 120, 122, 123, 124, 125, 126,
    133, 134, 137, 141, 143, 144, 145, 148, 152, 157, 159, 160, 162, 166, 167,
    168, 175, 191, 193, 195, 196, 199, 201, 202, 203, 205, 206, 207, 209, 215,
    216, 218, 222, 224, 225, 233, 239, 241, 244, 245, 246, 247, 248, 254, 262,
    263, 270, 278, 279, 280, 281, 283, 285, 286, 292, 296, 299, 310, 314, 316,
    317, 318, 319, 322, 323, 326, 329, 330, 331, 332, 334, 335, 336, 337, 338,
    341, 342, 345, 355, 360, 363, 372,
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
