# 2026-05-28 — Drop “methodology signal” gate in SLR classification

## Summary

We **removed the “methodology/protocol signal” requirement** from SLR/SMS classification. Previously, a candidate SLR was only included if its title/abstract contained at least one protocol keyword (e.g., PRISMA, Kitchenham, inclusion criteria). This gate had **high false-negative risk** because many legitimate SLR/SMS abstracts omit protocol vocabulary.

The resulting SS (Semantic Scholar) corpus size increased materially and now better matches expectations from other sources (e.g., ACM).

## Rationale

- **Recall vs precision**: The methodology-signal gate was intended to filter narrative surveys masquerading as “systematic reviews”. In practice it excluded legitimate SLR/SMS papers whose abstracts did not explicitly mention protocol terms.
- **Empirical evidence (SS run)**: We observed many SS candidates failing *only* due to missing protocol vocabulary, despite being self-labeled SLR/SMS and matching subfield keywords and year bounds.

## What changed

### Classification logic

File: `01_identify_slrs/classify_slrs.py`

- Removed the check requiring a “methodology signal” keyword in the title/abstract.
- Updated the include reason text accordingly.

This means a candidate is now included if it satisfies:

- subfield keyword fit (title or abstract contains a configured keyword)
- SLR/SMS self-label present (title, with abstract fallback)
- year within `[year_min, year_max]`

### Report wording

File: `report/report.md`

- Updated §2.3 to remove the methodology-signal bullet.
- Updated the SS trimming paragraph in §3.1 to reflect the new included count.

## Before/after (Semantic Scholar source)

Command:

```bash
PYTHONPATH=. python3 01_identify_slrs/classify_slrs.py --source ss
```

Observed results:

- **Before** (with methodology-signal gate): **21 INCLUDE**, 8396 EXCLUDE (from 8417 candidates)
- **After** (gate removed): **74 INCLUDE**, 8343 EXCLUDE (from 8417 candidates)

Artifacts written by the classification step:

- Corpus: `data/processed/ss/slr_corpus.json`
- Decision audit trail: `data/manual/ss/slr_decisions.csv`

## Notes / follow-ups

- Downstream stages that depend on the SS corpus (reference extraction, overlap, gap analysis) should be re-run for SS to reflect the expanded corpus.
- We still rely on **Semantic Scholar’s reference graph**; some SLRs may have references unavailable via the API even if the paper itself has a bibliography.

