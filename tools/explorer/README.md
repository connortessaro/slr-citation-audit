# SLR Citation Overlap Explorer

Interactive browser dashboard for the Semantic Scholar pipeline outputs: SLR reference lists, top-cited corpus overlap, hits/misses, and coverage stats.

## Run

From the **repository root**:

```bash
python tools/explorer/serve.py
```

Opens [http://127.0.0.1:8765/tools/explorer/](http://127.0.0.1:8765/tools/explorer/) (use `--no-open` to skip launching a tab).

Custom port:

```bash
python tools/explorer/serve.py --port 9000
```

Requires processed data:

- `data/processed/ss/slr_corpus.json`
- `data/processed/ss/slr_references.json`
- `data/processed/top_cited_techdebt.json`
- `data/processed/top_cited_techdebt_top100.json`
- `data/processed/top_cited_techdebt_meta.json` (optional)
- `docs/research_paper_methods_snapshot.md` (Methods page)

Coverage is **recomputed in the browser** from references + the selected benchmark JSON (not fixed to `overlap_matrix.csv`), so settings can be changed without re-running Python.

## Layout

The explorer uses a **console-style layout**: a fixed left sidebar for navigation, a settings bar at the top, and a full-height content area. List + detail panels sit side-by-side so selecting an item shows its information immediately without scrolling past unrelated content.

## Settings bar

| Control | Options | Effect |
|---------|---------|--------|
| **Benchmark** | Top 50 / Top 100 | Loads `top_cited_techdebt.json` vs `top_cited_techdebt_top100.json`; updates coverage, charts, lists |
| **SLR cohort** | All / 2015–2019 / 2020+ | Filters which SLRs appear in KPIs, tables, and overlap views |
| **Benchmark pass** | All / Established / Recent | Subsets benchmark by `_pass` field (two-pass methodology) |

The subtitle in the sidebar reflects the active combination.

## Pages

| Page | Purpose |
|------|---------|
| **Overview** | Hero insight, KPIs (zero-coverage highlighted), charts, cohort table, coverage extremes, quick links |
| **SLRs** | List + tabbed detail: Summary, References, Hits, Misses, Compare |
| **Top cited** | Benchmark papers or SLR consensus bibliography (toggle); tabbed detail for citing/missing SLRs |
| **Methods** | Renders `docs/research_paper_methods_snapshot.md` for the paper |

### SLR detail tabs

| Tab | Content |
|-----|---------|
| Summary | Coverage stats + gauge |
| References | Full reference list with top-cited badges |
| Hits / Misses | Eligible benchmark papers cited or not cited |
| Compare | Pairwise reference overlap (Jaccard) with another SLR |

### Top cited modes

| Mode | Content |
|------|---------|
| **Benchmark** | Top-cited corpus papers; detail tabs for summary, citing SLRs, missing SLRs |
| **Consensus** | Papers most cited across SLR bibliographies; optional filter to benchmark only |

Matching uses the same `paper_key` rules as the pipeline (DOI → Semantic Scholar id → normalized title).

## Paper documentation

- `docs/research_paper_methods_snapshot.md` — numbers and narrative for the write-up
- `docs/top_cited_methodology.md` — two-pass benchmark
- `docs/slr_identification_gates.md` — SLR inclusion gates
