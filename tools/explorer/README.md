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
| **Overview** | Hero insight, KPIs (zero-coverage highlighted), charts, coverage extremes (full width), quick links |
| **SLRs** | List + tabbed detail: Summary, References, Hits, Misses, Compare |
| **Top cited** | Hybrid layout: summary strip (hero, KPIs, dual charts) + list/detail drill-down |
| **Methods** | Renders `docs/research_paper_methods_snapshot.md` for the paper |

### Top cited page

The Top cited page uses a **hybrid layout**: a summary strip at the top (always visible) plus a list + detail explorer below.

**Summary strip**

- Hero headline comparing benchmark overlap vs SLR consensus
- KPIs: benchmark size, median SLR citation rate across benchmark, papers in both lists, high-consensus outside benchmark, most-missed top-10
- Dual charts: SS benchmark top 10 (citation count) and SLR consensus top 15 (teal = in benchmark)

**Exploration modes**

| Mode | List | Detail |
|------|------|--------|
| **Benchmark** | Top-cited corpus by rank | Summary (with citation-rate bar + link to Compare), Citing SLRs, Missing SLRs |
| **SLR consensus** | Papers ranked by how many SLRs cite them | Consensus stats; optional filter to benchmark papers only |
| **Compare** | Three sections: benchmark misses, SLR favorites outside benchmark, aligned papers | Overlap viz + lowest citation-rate chart (default); per-paper side-by-side stats when selected |

Compare mode answers: *what do SLRs collectively cite that differs from the external top-cited benchmark?*

### SLR detail tabs

| Tab | Content |
|-----|---------|
| Summary | Coverage stats + gauge |
| References | Full reference list with top-cited badges |
| Hits / Misses | Eligible benchmark papers cited or not cited |
| Compare | Pairwise reference overlap (Jaccard) with another SLR |

### Top cited modes (legacy reference)

See **Top cited page** above for the full layout. Quick reference:

| Mode | Content |
|------|---------|
| **Benchmark** | Top-cited corpus papers; detail tabs for summary, citing SLRs, missing SLRs |
| **SLR consensus** | Papers most cited across SLR bibliographies; optional filter to benchmark only |
| **Compare** | Benchmark vs SLR-consensus divergence with categorized lists and overlap viz |

Matching uses the same `paper_key` rules as the pipeline (DOI → Semantic Scholar id → normalized title).

## Paper documentation

- `docs/research_paper_methods_snapshot.md` — numbers and narrative for the write-up
- `docs/top_cited_methodology.md` — two-pass benchmark
- `docs/slr_identification_gates.md` — SLR inclusion gates
