# 06_rank — citation-quality ranking

Ranks SLRs by the quality of their bibliographies. Composite of 5 dimensions:

| Dim | What it measures |
|-----|------------------|
| `coverage` | % of date-controlled top-cited subfield papers cited (reuses `04_overlap`). |
| `semantic` | mean cosine(SLR embedding, ref embedding) via local sentence-transformers model. |
| `authority` | mean `log(1 + citationCount)` over refs. |
| `diversity` | Shannon entropy of cited venues and first authors (normalized). |
| `llm_judge` | DeepSeek V3 (free OpenRouter) rubric across 5 sub-dims, structured JSON. |

Each dim is min-max normalized across the SLR corpus; composite = weighted sum (default equal 0.2 each, configurable via `RANK_WEIGHTS`).

## Setup

Already covered by repo root `pip install -r requirements.txt`. Extra deps for this stage:

- `sentence-transformers` (loads Qwen3-Embedding-0.6B on first run — ~1.2 GB to `~/.cache/huggingface/`)
- `pymupdf` (PDF text extraction)
- `openai` (OpenRouter client via OpenAI-compatible base URL)
- `pydantic`, `numpy`

Add to `.env`:

```
OPENROUTER_API_KEY=sk-or-...
# Optional overrides (defaults shown):
LLM_JUDGE_MODEL=deepseek/deepseek-chat:free
EMBED_MODEL=Qwen/Qwen3-Embedding-0.6B
RANK_WEIGHTS=0.2,0.2,0.2,0.2,0.2
FULLTEXT_ENABLED=true
FULLTEXT_MAX_TOKENS=32000
```

OpenRouter free tier = **50 requests/day**. The corpus is ~50 SLRs, so a single end-to-end pass fits within the daily cap. Re-runs hit the disk cache and consume zero API budget. If you blow the cap, drop $10 of credits — that permanently raises the daily limit to 1000.

## Run

Stages are sequential and cache-safe (re-runs only do new work):

```bash
python 06_rank/fetch.py    # enrich abstracts/authors/OA PDFs
python 06_rank/embed.py    # Qwen3 embeddings -> embeddings.npz
python 06_rank/judge.py    # OpenRouter rubric scoring -> data/raw/llm_judge/
python 06_rank/rank.py     # compute dims + composite + write outputs
```

## Outputs

- `data/processed/paper_metadata.json` — enriched per-paper metadata
- `data/raw/fulltext/<key>.txt` — extracted PDF text (when OA available)
- `data/processed/embeddings.npz` — `{keys, vecs, embed_source, model}`
- `data/raw/llm_judge/<key>.json` — per-SLR cached LLM rubric response
- `data/processed/llm_judge_scores.json` — merged judge output
- `data/processed/ranked_slrs.csv` — final ranking, one row per SLR
- `data/processed/ranked_slrs.json` — full per-SLR breakdown (raw + normalized + justification)
- `report/ranking_report.md` — narrative report (top 5, bottom 5, methodology)

## Tests

```bash
pytest tests/test_rank.py -q
```

Tests cover the pure scoring functions (entropy, authority, semantic, judge aggregation, normalization, composite) plus the judge prompt-build and cache-hit short-circuit. They never make real network calls.

## Limitations

- Citation source is Semantic Scholar only (acknowledged in design plan).
- `semantic` dim degrades when refs lack abstracts (older venues; ~20–40% expected).
- `authority` is citation-count-based; a PageRank/centrality version over a richer subfield graph is a candidate extension.
- `llm_judge` is one model at `temperature=0`; cached results pin the score across re-runs, but the provider can still drift over weeks. Cache invalidation = delete the per-SLR `.json` file.
