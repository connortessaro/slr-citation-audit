# Design: slr-citation-audit

**Date:** 2026-05-27
**Status:** Approved
**Subfield:** Technical debt

## Goal

Quantify how well Systematic Literature Reviews (SLRs) in the technical debt
subfield cite the most-cited papers in that same subfield, and explain any
gaps. Output: 3,000-word report with implications for SLR practice.

## Research questions

1. What proportion of the top-50 most-cited technical debt papers are cited by
   each published SLR (with date controls)?
2. Where SLRs miss highly-cited papers, what explains the omission — venue,
   publication year, accessibility, or other features?
3. What practical implications follow for how SLRs should be conducted?

## Scope

- **Subfield:** technical debt (incl. design debt, architectural debt, code debt).
- **SLR sources:** ACM DL, IEEE Xplore, Semantic Scholar.
- **Citation source:** Semantic Scholar exclusively (acknowledged limitation).
- **Top-cited corpus size:** N = 50.
- **Year range:** 2000–2025 (subject to refinement at Day 2 sign-off).

## Pipeline (5 stages)

| Stage | Purpose | Inputs | Outputs |
|-------|---------|--------|---------|
| 01_identify_slrs | Find SLR candidates across 3 sources, dedupe, manually classify SLR vs general survey | keyword config, manual decisions CSV | `data/processed/slr_corpus.json` |
| 02_extract_refs | Pull each SLR's reference list via Semantic Scholar | slr_corpus.json | `slr_references.json` |
| 03_top_cited | Identify top-50 most-cited papers in subfield | keyword config | `top_cited_techdebt.json` |
| 04_overlap | Date-controlled overlap per SLR | corpus + refs + top-cited | `overlap_matrix.csv` |
| 05_explain_gaps | Enrich missed-paper records with venue, year, access | overlap_matrix + top-cited | `gap_analysis.csv` |

Final stage: `report/report.md` — 3,000-word writeup synthesising results.

## Key methodology decisions

- **Single citation source.** Semantic Scholar API is the authoritative count.
  Cross-DB variance is acknowledged as a limitation in the report, not papered
  over with averaging.
- **Manual SLR classification.** The boolean "is this paper an SLR?" cannot be
  resolved by title keywords alone (papers self-describe as "survey",
  "mapping", "review"). Manual review feeds `data/manual/slr_decisions.csv`
  with justification per paper.
- **Date control.** When computing overlap for an SLR published in year Y, the
  top-cited list is filtered to papers with `pub_year <= Y`. This prevents
  blaming SLRs for missing papers that did not yet exist.
- **Top-cited size N=50.** Tractable for manual sanity-checking; large enough
  to capture canonical works.

## Repo layout

```
slr-citation-audit/
├── README.md
├── .gitignore
├── requirements.txt
├── config/subfield.example.yaml
├── 01_identify_slrs/{search_*,merge_and_classify}.py
├── 02_extract_refs/fetch_references.py
├── 03_top_cited/fetch_top_cited.py
├── 04_overlap/{compute_overlap,date_controls}.py
├── 05_explain_gaps/analyze_gaps.py
├── data/{raw,processed,manual}/
├── notebooks/
├── report/report.md
└── docs/plans/
```

## Data cache

- `data/raw/` — one JSON file per API query (gitignored). Easy to inspect, easy
  to re-fetch on cache miss.
- `data/processed/` — merged + deduped pipeline outputs (tracked).
- `data/manual/` — human-coded decisions (tracked).

## Dependencies

`requests`, `pandas`, `pyyaml`, `ratelimit`, `tqdm`. No package install — scripts
run directly from numbered dirs.

## Risks & mitigations

| Risk | Mitigation |
|------|-----------|
| SLR vs survey classification subjective | Document criteria; record per-paper justification |
| Semantic Scholar coverage of older venues incomplete | Spot-check 10 top-cited against Google Scholar |
| ACM/IEEE search returns >>SLRs | Title regex prefilter + manual triage |
| Rate limits on Semantic Scholar | Use API key + ratelimit decorator; cache to data/raw/ |

## Milestones (from project brief)

- **Day 2** Subfield + SLR corpus confirmed; supervisor sign-off
- **Day 4** Reference lists extracted; top-cited compiled; overlap calculated
- **Day 8** Analysis complete; draft report
- **Day 10** Final report submitted

## Out of scope

- Cross-subfield comparison.
- Time-series analysis of citation drift.
- Author-level analyses (h-index, prolific reviewer effects).
- Building a generalised SLR-audit tool.

## Open items deferred to implementation plan

- Exact Semantic Scholar endpoints + pagination strategy
- IEEE/ACM access path (API vs export)
- Manual classification rubric details
- Report outline narrative arc
