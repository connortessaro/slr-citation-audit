# slr-citation-audit

A citation-coverage audit of Systematic Literature Reviews in the **technical-debt** subfield.

74 published reviews, 50 canonical papers, year-matched. Half the field cites less than 2% of it. 36 cite zero.

Live site: **<https://web-e4qhnnknz-connor-tessaros-projects.vercel.app>**

The repo is two things in one tree:
1. A 6-stage Python pipeline that pulls every paper cited by every published SLR, joins it against the Semantic Scholar top-50 for the same area, controls for publication year, and produces a 5-dimension composite ranking.
2. A Next.js 16 site under `web/` that renders the pipeline outputs as a dark-first, editorial dashboard.

## Quick links

- **Method explainer (live):** /method on the site, or `web/app/method/page.tsx`
- **Audit report:** [`AUDIT_REPORT.md`](./AUDIT_REPORT.md) (writing / CRO / design pass)
- **Build plan for the site:** [`web/BUILD_PLAN.md`](./web/BUILD_PLAN.md)
- **Motion roadmap:** [`web/MOTION_PLAN.md`](./web/MOTION_PLAN.md)

## Pipeline

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # add SEMANTIC_SCHOLAR_API_KEY + OPENROUTER_API_KEY
```

Run each stage in order. Each writes to `data/processed/`. Re-running is safe; everything is cache-backed.

| Stage | Reads | Writes | Purpose |
|---|---|---|---|
| `01_identify_slrs/` | SS API, ACM/IEEE BibTeX | `slr_corpus.json` | Find + classify SLR candidates |
| `02_extract_refs/` | corpus | `slr_references.json` | Pull each SLR's reference list |
| `03_top_cited/` | SS API (subfield query) | `top_cited_techdebt.json` | Top-N most-cited papers |
| `04_overlap/` | refs + top-cited | `overlap_matrix.csv` | Date-controlled coverage |
| `05_explain_gaps/` | overlap + metadata | `gap_analysis.csv` | Venue / year / access reasons |
| `06_rank/` | corpus + refs + overlap + metadata | `ranked_slrs.json` | 5-dim composite rank |

### Stage 06 — Ranker

Five dimensions, min-max normalized then weighted sum (default 0.2 each, configurable via `RANK_WEIGHTS`):

1. **Coverage** — canonical-paper recall, reused from stage 04.
2. **Semantic** — mean cosine similarity between SLR vector and reference vectors (Qwen3-Embedding-0.6B via sentence-transformers).
3. **Authority** — mean `log(1 + citationCount)` of references.
4. **Diversity** — `0.5 * H(venues) + 0.5 * H(first authors)` (Shannon entropy).
5. **LLM judge** — DeepSeek-style rubric via OpenRouter, temperature 0, cached per-SLR. 71/74 SLRs scored in the current build (owl-alpha + qwen fallbacks; the remaining 3 hit schema-validation errors and are scored on the other four dimensions only).

Pure scoring functions in `06_rank/rank.py` are independently testable and have no I/O — that's where new tests should hook in.

## Web (`/web`)

Next.js 16 App Router. React 19. Tailwind v4. Motion v12. React Three Fiber. Pure static build — reads `data/processed/*.json` at build time, no runtime API calls.

```bash
cd web
pnpm install
pnpm dev          # http://localhost:3000
pnpm build        # production build
pnpm test         # Playwright smoke tests
```

Routes:

| Route | What it shows |
|---|---|
| `/` | Hero stat, route index, most-cited callout, distribution histogram, full SLR table sorted by composite rank |
| `/slrs` / `/slrs/[id]` | Per-review coverage gauge, hits, missed canonical papers, all references, plus the rank breakdown with the LLM judge's per-SLR justification |
| `/papers` / `/papers/[id]` | Per-paper SLR recall, which SLRs cite it vs miss it (date-eligible) |
| `/consensus` | Most-cited papers across the union of all SLR bibliographies |
| `/compare` | Pairwise Jaccard similarity between any two SLRs' reference sets |
| `/graph` | 3D citation network (R3F + 3d-force-graph) |
| `/method` | This pipeline, explained |

Deployed on Vercel with auto-builds on push to `main`. Project root directory is `web/`; data files at `../data/processed/` are read at build time.

## Tests

```bash
pip install -r requirements-dev.txt
pytest -q                  # all pipeline tests
cd web && pnpm test        # Playwright smoke for the site
```

## CI

`.github/workflows/`:

- `tests` — pytest on every push / PR.
- `pipeline` — manual (`workflow_dispatch`). Runs all stages live, uploads `data/processed/` + `report/figures/` as artifacts; with `commit_results=true` pushes to `pipeline/results/<run_id>`.

Required secrets: `SEMANTIC_SCHOLAR_API_KEY`, optionally `IEEE_XPLORE_API_KEY` (IEEE falls back to manual BibTeX in `data/raw/ieee_exports/`). `OPENROUTER_API_KEY` is read locally for stage 06 but is never required by the pipeline workflow.

## Layout

| Path | Purpose |
|---|---|
| `01_identify_slrs/` … `06_rank/` | Pipeline stages |
| `lib/` | Shared helpers (SS client, `paper_key` dedup, config) |
| `tests/` | Pytest suite |
| `data/raw/` | Cached API JSON (gitignored) |
| `data/processed/` | Tracked pipeline outputs |
| `data/manual/` | Human-coded SLR-vs-survey decisions + rubric |
| `web/` | Next.js site (its own README + plans inside) |
| `report/` | Long-form writeup + figures + ranking_report.md |

## Method notes

- **Citation source:** Semantic Scholar. Known limitation; some SLRs return zero refs because SS doesn't have the bibliography.
- **SLR classification:** manual review (SLR vs general survey vs tertiary study).
- **Date control:** comparing an SLR to top-cited papers, top-cited is filtered to `pub_year ≤ SLR.pub_year`. Counting a paper an SLR couldn't have read isn't a miss; it's a calendar.
- **`paper_key`:** stable identifier across stages, resolved as normalized DOI → Semantic Scholar `paperId` → normalized title. Change it once and every join downstream stays consistent.

## License

Private coursework. Not for redistribution.
