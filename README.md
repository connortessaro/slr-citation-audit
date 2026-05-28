# slr-citation-audit

Evaluating citation coverage of Systematic Literature Reviews (SLRs) in the **technical debt** subfield.

Compares papers cited by published SLRs against the most-cited papers in the same space (via Semantic Scholar) to measure coverage gaps and investigate causes.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env to add your API keys.
```

### Configuration via `.env`

All configuration lives in `.env` (gitignored). `.env.example` is the tracked template — copy it and fill in values.

| Variable | Required? | Purpose |
|----------|-----------|---------|
| `SEMANTIC_SCHOLAR_API_KEY` | strongly recommended | Anon pool returns `429 Too Many Requests` during peak hours. Request: <https://www.semanticscholar.org/product/api#api-key-form> |
| `IEEE_XPLORE_API_KEY` | optional | Without it, IEEE search falls back to manual BibTeX exports in `data/raw/ieee_exports/`. Register: <https://developer.ieee.org/member/register> |
| `SUBFIELD`, `KEYWORDS`, `YEAR_MIN`, `YEAR_MAX`, `SLR_TITLE_PATTERNS`, `TOP_N`, `SS_BASE_URL` | optional | Retarget the pipeline to a different subfield without code changes |

ACM Digital Library has no public API. Workflow: search <https://dl.acm.org/action/doSearch> → export results as BibTeX → drop into `data/raw/acm_exports/`.

## Run

Pipeline is staged. Run each in order:

```bash
python 01_identify_slrs/search_semantic_scholar.py
python 01_identify_slrs/search_acm.py
python 01_identify_slrs/search_ieee.py
python 01_identify_slrs/merge_and_classify.py
python 02_extract_refs/fetch_references.py
python 03_top_cited/fetch_top_cited.py
python 04_overlap/compute_overlap.py
python 05_explain_gaps/analyze_gaps.py
python report/build_figures.py
```

Outputs land in `data/processed/`. Figures in `report/figures/`. Final writeup in `report/report.md`.

## CI / hosted pipeline

Two GitHub Actions workflows:

- **`tests`** — runs pytest on every push / PR.
- **`pipeline`** — manual trigger (`workflow_dispatch`). Runs all 7 stages against live Semantic Scholar (and IEEE if `secrets.IEEE_XPLORE_API_KEY` is set), uploads `data/processed/` + `report/figures/` as build artifacts, and (if `commit_results=true`) pushes outputs to a `pipeline/results/<run_id>` branch.

Required repo secrets:

- `SEMANTIC_SCHOLAR_API_KEY` (already added).
- `IEEE_XPLORE_API_KEY` (optional; manual BibTeX export is the fallback).

Trigger the pipeline: **Actions → pipeline → Run workflow**.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q
```

## Layout

| Path | Purpose |
|------|---------|
| `01_identify_slrs/` | Find SLR candidates across ACM, IEEE, Semantic Scholar |
| `02_extract_refs/` | Pull reference list for each SLR |
| `03_top_cited/` | Identify top-50 cited papers in subfield |
| `04_overlap/` | Compute overlap with date controls |
| `05_explain_gaps/` | Investigate gaps (venue, year, access) |
| `data/raw/` | Cached API JSON (gitignored) |
| `data/processed/` | Merged tracked outputs |
| `data/manual/` | Human-coded SLR-vs-survey decisions + rubric |
| `lib/` | Shared helpers (SS client, paper-ID normalisation, config) |
| `tests/` | Pytest suite (67 tests as of Phase 7) |
| `report/` | Final 3,000-word writeup + figures |
| `docs/plans/` | Design + implementation plans |

## Method notes

- **Citation source:** Semantic Scholar (single source; documented limitation).
- **SLR classification:** manual review required (SLR vs general survey).
- **Date control:** when comparing an SLR to top-cited list, top-cited is filtered to `pub_year ≤ SLR.pub_year`.

## License

Private coursework. Not for redistribution.
