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
- `data/processed/ss/overlap_matrix.csv`
- `data/processed/top_cited_techdebt.json`

Re-run `04_overlap/compute_overlap.py` after changing references or top-cited.

## Views

| Tab | Purpose |
|-----|---------|
| **Overview** | KPIs, coverage histogram, top-cited citation chart, sortable SLR table |
| **SLRs** | Pick an SLR → references, top-cited hits/misses, coverage gauge |
| **Top cited** | Pick a top-50 paper → which SLRs cite it vs miss it (among eligible) |

Matching uses the same `paper_key` rules as the pipeline (DOI → Semantic Scholar id → normalized title).
