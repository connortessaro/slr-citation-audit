"""Apply AI-assisted triage decisions to data/manual/slr_decisions.csv.

The DROP_INDICES list below records the 1-based positions (when the corpus is
sorted by _paper_key ascending) of papers I marked EXCLUDE after reading each
abstract. Keep this script + the dump it was made from in the audit trail so
decisions are reproducible.

Usage:
    python3 data/manual/_apply_triage.py

Effect: rewrites data/manual/slr_decisions.csv with an `override_verdict`
column set to EXCLUDE for the dropped papers. Re-running
01_identify_slrs/merge_and_classify.py picks up these overrides.
"""

from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CORPUS_PATH = REPO / "data" / "processed" / "slr_corpus.json"
DECISIONS_PATH = REPO / "data" / "manual" / "slr_decisions.csv"

# 1-based indices of DROP decisions in the corpus when sorted by _paper_key asc.
DROP_INDICES = {
    5, 12, 13, 15, 20, 23, 26, 30, 31, 32, 35, 38, 40, 43, 51, 52, 54, 56, 57, 58,
    60, 62, 63, 64, 66, 67, 70, 71, 74, 76, 77, 80, 81, 84, 88, 89, 90, 95, 96, 97,
    98, 99, 101, 103, 106, 109, 110, 112, 113, 115, 116, 117, 120, 121, 124, 125,
    126, 127, 128, 134, 136, 137, 138, 139, 141, 142, 143, 144, 146, 147, 148, 150,
    152, 153, 154, 155, 160, 163, 165, 167, 168, 171, 172, 173, 174, 175, 176, 177,
    178, 179, 180, 181, 184, 187, 189,
}


def main() -> None:
    corpus = json.loads(CORPUS_PATH.read_text(encoding="utf-8"))
    corpus.sort(key=lambda p: p.get("_paper_key", ""))

    drop_keys: set[str] = set()
    for i, paper in enumerate(corpus, start=1):
        if i in DROP_INDICES:
            drop_keys.add(paper["_paper_key"])

    if len(drop_keys) != len(DROP_INDICES):
        sys.exit(f"Drop key count {len(drop_keys)} != indices {len(DROP_INDICES)} — corpus order changed?")

    # Mutate the existing slr_decisions.csv: set override_verdict=EXCLUDE for
    # every drop_key. Leave verdict column untouched so the audit trail still
    # shows the auto-classifier's call.
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
