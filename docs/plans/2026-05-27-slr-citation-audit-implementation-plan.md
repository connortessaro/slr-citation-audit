# Implementation Plan: slr-citation-audit

**Date:** 2026-05-27
**Status:** Approved
**Companion to:** `2026-05-27-slr-citation-audit-design.md`

## Locked decisions

| Decision | Choice |
|---------|--------|
| TDD strictness | Tests written **after** each stage, before moving on |
| Semantic Scholar client | `semanticscholar` pip pkg (not custom requests wrapper) |
| Report figures | Matplotlib charts (coverage histogram + gap heatmap) |
| SLR classification rubric | Drafted entirely by assistant, not user-reviewed |

## Phases

### Phase 1 - Foundation
- `lib/__init__.py`
- `lib/ss_client.py` - thin wrapper around `semanticscholar` w/ persistent JSON cache (`data/raw/ss_cache/`) + ratelimit
- `lib/paperid.py` - DOI / Corpus ID normalisation, title-fuzzy dedup
- `lib/config.py` - load `config/subfield.yaml`, expose typed constants
- `requirements-dev.txt`: `pytest`, `pytest-mock`, `responses`, `matplotlib`
- `conftest.py` with shared fixtures (sample paper JSONs)
- **No tests yet** - tests come after stage implementations (per locked TDD choice)

### Phase 2 - SLR identification
- `01_identify_slrs/search_semantic_scholar.py` - keyword search via SS, title-pattern prefilter, write `data/raw/ss_slr_candidates.json`
- `01_identify_slrs/search_acm.py` - parse manual BibTeX export at `data/raw/acm_exports/*.bib` (ACM API gated)
- `01_identify_slrs/search_ieee.py` - IEEE Xplore API if key, else manual export parser
- `01_identify_slrs/merge_and_classify.py` - dedup, apply classification rubric (auto + manual override), write `data/processed/slr_corpus.json`
- `data/manual/CLASSIFICATION.md` - assistant-drafted rubric (no user review step)
- Tests in `tests/test_01_identify.py` after stage works end-to-end on a small sample

### Phase 3 - Reference extraction
- `02_extract_refs/fetch_references.py` - per SLR, paginate SS `/paper/{id}/references`, cache per-SLR at `data/raw/refs/{slr_id}.json`, resume-on-failure, merge → `data/processed/slr_references.json`
- Tests in `tests/test_02_extract.py` (mock SS via `responses`)

### Phase 4 - Top-cited corpus
- `03_top_cited/fetch_top_cited.py` - SS bulk search, two-pass `citationCount` ranking (established + recent), write `top_cited_techdebt.json` + `top_cited_techdebt_meta.json` (see `docs/top_cited_methodology.md`)
- Tests in `tests/test_03_top_cited.py`

### Phase 5 - Overlap
- `04_overlap/date_controls.py` - `filter_by_year(top_cited, cutoff_year)`
- `04_overlap/compute_overlap.py` - per-SLR coverage with date control, emit `overlap_matrix.csv` (cols: `slr_id`, `slr_year`, `eligible_top_n`, `hits`, `coverage_pct`)
- Tests in `tests/test_04_overlap.py` (toy fixtures)

### Phase 6 - Gap explanation
- `05_explain_gaps/analyze_gaps.py` - for each (SLR, missed top-cited paper) pair, enrich with venue, year delta, open-access (`openAccessPdf`), language; emit `data/processed/gap_analysis.csv`
- `notebooks/gap_aggregations.ipynb` - missed-by-venue, missed-by-year-bucket

### Phase 7 - Report
- `report/report.md` - fill 3,000-word writeup using `ecc:article-writing` patterns
- `report/figures/coverage_histogram.png` - matplotlib
- `report/figures/gap_heatmap.png` - venue × year-bucket missed rate
- Hedge conclusions, document limitations (single citation source, classification subjectivity)

## Dependency additions

Runtime: `semanticscholar` (new), plus existing `requests` etc.
Dev: `pytest`, `pytest-mock`, `responses`, `matplotlib`.
Optional: `bibtexparser` (only if ACM exports needed).

## Risks (carry-forward from design)

| Risk | Level | Mitigation |
|------|-------|-----------|
| ACM no public API | HIGH | Document manual export procedure; track BibTeX in `data/raw/acm_exports/` |
| IEEE API key unavailable | MED | Manual export fallback |
| SS coverage weak for older venues | MED | Spot-check 10 papers; log in limitations |
| SLR classification subjective | MED | Rubric authored by assistant; record reasoning per paper |
| SS rate limits without key | LOW | Cache + ratelimit decorator |
| Top-50 ranking volatility | LOW | Save top-100 for robustness check |

## Estimated effort

20-30h over 10 days. Phase 2 (identification) + Phase 7 (report) absorb most time.

## Out of scope

(see design doc) - no cross-subfield comparison, no time-series, no author-level analysis.
