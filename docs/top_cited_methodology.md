# Top-cited corpus methodology

This document describes how `data/processed/top_cited_techdebt.json` is built. The benchmark feeds overlap analysis (stage `04_overlap`) and gap explanation (stage `05_explain_gaps`).

## Goal

Identify **N = 50** papers that represent both:

1. **Accumulated influence** - highly cited work old enough to have had time to attract citations.
2. **Recent momentum** - highly cited work from the last few years, which raw lifetime ranking would under-represent.

Citation counts come from **Semantic Scholar** only (same source as SLR reference metadata).

## Discovery pool

1. For each subfield keyword in `config/subfield.yaml` (`technical debt`, `code debt`, etc.), query Semantic Scholar with `year_min`-`year_max` and **limit = 1,000** (relevance order; API cap).
2. **Deduplicate** by `paper_key` (DOI, SS `paperId`, or normalised title).
3. **Subfield filter:** keyword must appear in **title or abstract** (case-insensitive), matching SLR identification elsewhere in the project.

Papers outside this pool cannot appear in the top-50, even if they are highly cited globally.

## Two-pass selection

Parameters in config under `top_cited`:

| Field | Default | Meaning |
|-------|---------|---------|
| `recent_years` | 4 | Width of the “recent” window |
| `as_of_year` | `year_max` | Reference year for age split (typically current study year) |
| `robustness_n` | 100 | Larger two-pass list for sensitivity checks |

**Cutoff:** `cutoff_year = as_of_year - recent_years` (e.g. 2022 when `as_of_year = 2026`).

| Pass | Eligibility | Quota (N = 50) | Rank by |
|------|-------------|----------------|---------|
| **Established** | `year ≤ cutoff_year` | 25 | `citationCount` descending |
| **Recent** | `year > cutoff_year` | 25 | `citationCount` descending |

The primary file is the **concatenation** established → recent (global `_rank` 1…50). Each record includes:

- `_pass`: `established` | `recent` | `backfill` (only if a pass could not fill its quota)
- `_pass_rank`: rank within that pass
- `_paper_key`: stable id for overlap matching

If one pass has fewer than 25 eligible papers, the shortfall is filled from the **global** citation-ranked pool (`_pass = backfill`).

## Outputs

| File | Description |
|------|-------------|
| `top_cited_techdebt.json` | Primary top-50 |
| `top_cited_techdebt_top100.json` | Two-pass top-100 (50 + 50) |
| `top_cited_techdebt_meta.json` | Pool sizes, quotas, pass counts |

## Relation to SLR overlap

Overlap logic is **unchanged**: for an SLR published in year *Y*, only benchmark papers with `year ≤ Y` count as eligible. Recent-pass papers therefore mostly affect coverage for **newer** SLRs.

Re-run after refreshing the benchmark:

```bash
PYTHONPATH=. python 03_top_cited/fetch_top_cited.py
PYTHONPATH=. python 04_overlap/compute_overlap.py --source ss
PYTHONPATH=. python 05_explain_gaps/analyze_gaps.py --source ss
```

## Limitations (explicit)

- **Search ceiling:** ranking only considers papers in the SS keyword search top 1,000 per query, not the full literature.
- **No field normalization:** we use raw `citationCount`, not OpenAlex FWCI.
- **Keyword corpus:** broader than title-only `"technical debt"`; see `data/manual/CLASSIFICATION.md` for subfield wording.
- **Pre-2000 seminal work** is excluded by `year_min` (e.g. Cunningham 1992) unless `year_min` is lowered.

## Rationale

This follows the “established + recent” union design discussed for the project: a single raw-citation list overweights older papers; splitting passes surfaces current highly cited work while keeping canonical older hits in the benchmark.
