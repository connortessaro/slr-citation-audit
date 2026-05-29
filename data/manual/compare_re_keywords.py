"""A/B comparison of two keyword strategies for the RE corpus.

Tight: 5 specific multi-word phrases naming research areas.
Broad: tight + 4 broader terms ("software requirements", "functional requirements",
       "requirements management", "requirements specification").

Reports:
    1. Corpus sizes and overlap
    2. Canonical RE SLR recall (which strategy catches known canonicals)
    3. Noise sample from B \\ A: random papers only the broad set caught, scored
       by whether their title/abstract suggests RE-as-research-subject vs
       RE-as-passing-mention
"""
from __future__ import annotations

import json
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from lib.config import REPO_ROOT  # noqa: E402

TIGHT_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus_re_tight.json"
BROAD_PATH = REPO_ROOT / "data" / "processed" / "slr_corpus_re_broad.json"

# Lowercase substring needles. Match against title + concatenated authors.
CANONICAL_NEEDLES = [
    ("Inayat et al. 2014 - Agile RE practices", "inayat"),
    ("Schon et al. 2017 - Agile RE SLR", "schon"),
    ("Curcio et al. 2018 - RE in agile mapping", "curcio"),
    ("Pacheco et al. 2018 - Req prioritization SLR", "pacheco"),
    ("Davis et al. 2006 - RE effort estimation SLR", "davis"),
    ("Heindl & Biffl 2005 - value-based req tracing", "heindl"),
    ("Sommerville (any SLR citing him as author)", "sommerville"),
    ("Pohl (any SLR by Pohl)", "klaus pohl"),
    ("Cheng & Atlee 2007 - RE directions", "atlee"),
    ("Berry (req engineering classics)", "daniel berry"),
]


def _haystack(p: dict) -> str:
    auths = p.get("authors")
    if isinstance(auths, list):
        astr = " ".join(
            (a.get("name") if isinstance(a, dict) else str(a)) or ""
            for a in auths
        )
    else:
        astr = str(auths or "")
    return ((p.get("title") or "") + " " + astr).lower()


def main() -> None:
    tight = json.loads(TIGHT_PATH.read_text(encoding="utf-8"))
    broad = json.loads(BROAD_PATH.read_text(encoding="utf-8"))

    tight_keys = {p["_paper_key"] for p in tight}
    broad_keys = {p["_paper_key"] for p in broad}
    only_broad = broad_keys - tight_keys
    only_tight = tight_keys - broad_keys
    both = tight_keys & broad_keys
    broad_by_key = {p["_paper_key"]: p for p in broad}

    print("=== 1. Corpus sizes ===")
    print(f"  tight : {len(tight)} SLRs")
    print(f"  broad : {len(broad)} SLRs")
    print(f"  intersection (in both): {len(both)}")
    print(f"  broad only             : {len(only_broad)}")
    print(f"  tight only             : {len(only_tight)}  (sanity check: should be 0 if broad ⊇ tight)")

    print()
    print("=== 2. Canonical RE SLR recall ===")
    for label, needle in CANONICAL_NEEDLES:
        tight_hits = [p for p in tight if needle in _haystack(p)]
        broad_hits = [p for p in broad if needle in _haystack(p)]
        tag = "BOTH " if tight_hits and broad_hits else "BROAD" if broad_hits else "----"
        sample = (broad_hits or tight_hits)
        snippet = (sample[0].get("title") or "")[:70] if sample else "—"
        print(f"  [{tag}] {label:48s} {snippet}")

    print()
    print("=== 3. Spot-sample noise from broad-only (20 papers) ===")
    sample_keys = random.Random(42).sample(sorted(only_broad), min(20, len(only_broad)))
    for k in sample_keys:
        p = broad_by_key[k]
        print(f"  [{p.get('year')}] {(p.get('title') or '')[:100]}")


if __name__ == "__main__":
    main()
