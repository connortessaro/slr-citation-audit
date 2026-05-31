# slr-citation-audit

Evaluating citation coverage of Systematic Literature Reviews (SLRs) in the **technical debt** subfield.

Compares papers cited by published SLRs against the most-cited papers in the same space (via Semantic Scholar) to measure coverage gaps and investigate causes.

## Setup

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp config/subfield.example.yaml config/subfield.yaml
```

Set Semantic Scholar API key (optional, raises rate limits):

```bash
export SEMANTIC_SCHOLAR_API_KEY=...
```

## Run

From the repo root, set `PYTHONPATH=.` (or `export PYTHONPATH=.` for the session) so `lib` imports resolve.

### Database-first entrypoints (recommended)

Run each dataset fully independently:

```bash
PYTHONPATH=. python sources/ss/run.py
PYTHONPATH=. python sources/acm/run.py
PYTHONPATH=. python sources/ieee/run.py
```

Each writes to:

- `data/raw/<source>/...`
- `data/processed/<source>/...`
- `data/manual/<source>/...`

### Stage-by-stage (advanced / debugging)

Pipeline is staged. Run each in order:

```bash
PYTHONPATH=. python 01_identify_slrs/search_semantic_scholar.py
```

Preview Semantic Scholar results (one search, five papers, prints a sample):

```bash
PYTHONPATH=. python 01_identify_slrs/search_semantic_scholar.py --max-searches 1 --limit 5 --preview
```

Writes `data/raw/ss/slr_candidates.preview.json` when `--max-searches` is set; full runs use `data/raw/ss/slr_candidates.json`.

Publication years are controlled in `config/subfield.yaml` (`year_min`–`year_max`, default **2000–2026**). Changing the range requires re-running SS searches (cache keys include the year string). To keep an older candidate file while fetching a wider range:

```bash
cp data/raw/ss/slr_candidates.json data/raw/ss/slr_candidates.backup.json
PYTHONPATH=. python 01_identify_slrs/search_semantic_scholar.py --append
```

`--append` dedupes the new fetch with the existing `slr_candidates.json` by paper id / DOI / title.

```bash
PYTHONPATH=. python 01_identify_slrs/search_acm.py
PYTHONPATH=. python 01_identify_slrs/search_ieee.py
PYTHONPATH=. python 01_identify_slrs/classify_slrs.py --source ss
PYTHONPATH=. python 01_identify_slrs/classify_slrs.py --source acm
PYTHONPATH=. python 01_identify_slrs/classify_slrs.py --source ieee
PYTHONPATH=. python 02_extract_refs/fetch_references.py --source ss
# Crossref backfill for empty SS refs runs automatically in pipelines/ss/run.py (or standalone):
PYTHONPATH=. python 02_extract_refs/fetch_references_crossref.py --source ss --merge
PYTHONPATH=. python 02_extract_refs/fetch_references.py --source acm
PYTHONPATH=. python 02_extract_refs/fetch_references.py --source ieee
PYTHONPATH=. python 03_top_cited/fetch_top_cited.py
PYTHONPATH=. python 04_overlap/compute_overlap.py --source ss
PYTHONPATH=. python 04_overlap/compute_overlap.py --source acm
PYTHONPATH=. python 04_overlap/compute_overlap.py --source ieee
PYTHONPATH=. python 05_explain_gaps/analyze_gaps.py --source ss
PYTHONPATH=. python 05_explain_gaps/analyze_gaps.py --source acm
PYTHONPATH=. python 05_explain_gaps/analyze_gaps.py --source ieee
PYTHONPATH=. python report/build_figures.py --source ss
PYTHONPATH=. python report/build_figures.py --source acm
PYTHONPATH=. python report/build_figures.py --source ieee
```

Outputs land in `data/processed/<source>/`. Figures in `report/figures/<source>/`. Final writeup in `report/report.md`.

### Overlap explorer (browser)

After overlap is computed for SS:

```bash
python tools/explorer/serve.py
```

Opens an interactive dashboard at `http://127.0.0.1:8765/tools/explorer/`. See `tools/explorer/README.md`. Tabs include **SLR consensus** (most-cited papers across SLR bibliographies) and **Compare SLRs** (pairwise reference overlap).

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
| `data/raw/<source>/` | Per-source cached API JSON + exports |
| `data/processed/<source>/` | Per-source outputs (corpus, refs, overlap, gaps) |
| `data/manual/<source>/` | Per-source SLR inclusion decisions + audit trail |
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
