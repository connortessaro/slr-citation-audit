# Data Collection & Ingestion

## Datasets Targeted / Ingested

### 1. Systematic Literature Review Corpus
**Source:** Semantic Scholar API only. ACM and IEEE exports were attempted for traceability but did not contribute to the final corpus.

| Source | Method | Output | Used in analysis? |
|--------|--------|--------|:-----------------:|
| [Semantic Scholar API](https://api.semanticscholar.org/graph/v1) | 16 keyword searches over 2000–2026: each of 4 subfield terms (`technical debt`, `code debt`, `design debt`, `architectural debt`) crossed with each of 3 review phrases (`systematic literature review`, `systematic review`, `systematic mapping`), plus 4 broad keyword-only passes with a title-pattern post-filter. | `data/raw/ss_slr_candidates.json` | **Yes** |
| ACM Digital Library | BibTeX exports manually downloaded and parsed | `data/raw/acm_slr_candidates.json` | No — parsed but no entries merged into final corpus |
| IEEE Xplore | Not ingested | — | No |

Every entry in `data/processed/ss/slr_corpus.json` has `source: "ss"`. The final analysis corpus is **60 SLRs** (39 full SLRs, 19 systematic mapping studies, 2 surveys), all sourced from Semantic Scholar.

### 2. Reference Lists per SLR
**Source:** Two resolvers, tried in order per SLR.

- **Semantic Scholar `/paper/{id}/references`** — primary; covers most papers by SS id or DOI
- **Crossref Works API** (`02_extract_refs/fetch_selected_studies.py`) — fallback for SLRs where SS returned no references; queries `api.crossref.org/works/{doi}` by the SLR's DOI

SLRs that still had no bibliography after both sources were excluded from the analysis corpus (50 of 110 auto-included candidates were dropped on this basis).

For a subset of Elsevier-hosted SLRs, a Playwright-based scraper (`lib/scrape_adapters/`) fetches Appendix B reference lists directly from the publisher page when the API returns incomplete data.

### 3. Top-Cited Technical Debt Corpus
**Source:** Semantic Scholar keyword search API, ranked locally by citation count using a two-pass design.

The SS API does not support native "sort by citations", so the pipeline issues a wide keyword search (up to 1,000 results per query, relevance order), pools the results across all 4 keywords, deduplicates, and filters to papers whose title or abstract includes a subfield keyword. The resulting discovery pool (~958 papers) is then split:

| Pass | Eligibility | Quota | Ranked by |
|------|-------------|-------|-----------|
| Established | year ≤ 2022 | 25 papers | `citationCount` descending |
| Recent | year > 2022 | 25 papers | `citationCount` descending |

Result: **50 canonical papers** selected as the required-reading benchmark. A 100-paper robustness list is also produced.

Outputs:
- `data/processed/top_cited_techdebt.json` — primary 50-paper benchmark
- `data/processed/top_cited_techdebt_top100.json` — 100-paper robustness list

---

## Cleaning Activities

### Deduplication (`lib/paperid.py`)
Every paper from every source is assigned a stable `paper_key` using a priority chain:

```
DOI (normalized) → Semantic Scholar paperId → normalized title
```

- DOI normalization strips `https://doi.org/`, `doi:` prefixes and lowercases the result
- Title normalization applies Unicode NFKD decomposition, ASCII folding, and strips all non-alphanumeric characters before comparison
- `dedup_by_key()` discards any paper whose key was already seen, regardless of source

### SLR Classification (`01_identify_slrs/merge_and_classify.py`)
Automated verdict applied to each candidate:
- Paper must have an SLR self-label in its title **or** contain protocol-language signals in its abstract (`prisma`, `kitchenham`, `search string`, `inclusion criteria`, `exclusion criteria`, `primary studies`, `snowballing`, etc.)
- Papers failing both checks are excluded from the corpus
- A `data/manual/slr_decisions.csv` audit trail records verdict + reason for every candidate; any row with an `override_verdict` column overrides the automated decision

### Date-Controlled Filtering (`04_overlap/date_controls.py`)
For each (SLR, top-cited paper) pair, a top-cited paper is only counted as **eligible** if its publication year ≤ the SLR's publication year. Papers with no recorded year are excluded from the denominator entirely — they cannot be date-controlled.

This ensures an SLR is never penalized for "missing" a paper that didn't exist when it was written. Coverage is computed as:

```
coverage = hits / eligible_top_n
```

where `eligible_top_n` is the count of top-cited papers that predate or match the SLR's year.

### Reference Key Resolution
Incoming references from Semantic Scholar and Crossref use different identifier schemes. All references are passed through `paper_key()` before matching, so a hit is registered regardless of whether the SLR cited a paper by DOI, SS id, or title-match.

---

## Data Location for Reproducibility

Processed overlap outputs for the 60-SLR SS analysis are in `data/processed/ss/`. Raw API dumps are gitignored.

```
data/
├── processed/ss/            ← primary analysis dataset (60 SLRs, tracked in git)
│   ├── slr_corpus.json          60 SLRs with metadata + classification
│   ├── slr_references.json      reference lists keyed by slr paper_key
│   ├── overlap_matrix.csv       coverage % per SLR (date-controlled)
│   ├── missed_pairs.csv         (SLR, missed paper) pairs
│   └── gap_analysis.csv         missed pairs with venue/age/OA annotations
├── processed/               ← broader pipeline outputs (tracked in git)
│   └── top_cited_techdebt.json  50-paper canonical benchmark
├── raw/                     ← gitignored; regenerate via pipeline
│   ├── ss_slr_candidates.json
│   ├── acm_slr_candidates.json
│   └── ss/                      per-paper Semantic Scholar cache
└── manual/
    ├── CLASSIFICATION.md        classification protocol
    └── slr_decisions.csv        one row per candidate, verdict + reason
```

To reproduce from scratch:
```bash
cp .env.example .env          # add SEMANTIC_SCHOLAR_API_KEY
python 01_identify_slrs/search_semantic_scholar.py
python 01_identify_slrs/merge_and_classify.py
python 02_extract_refs/fetch_references.py
python 03_top_cited/fetch_top_cited.py
python 04_overlap/compute_overlap.py
python 05_explain_gaps/analyze_gaps.py
```

---

## Example: Accessing the Datasets

### Load the SLR corpus
```python
import json
from pathlib import Path

REPO = Path(__file__).parent.parent  # adjust to your working directory
corpus = json.loads((REPO / "data/processed/ss/slr_corpus.json").read_text())

print(f"{len(corpus)} SLRs loaded")
# 60 SLRs loaded

for slr in corpus[:3]:
    print(slr["title"], "|", slr.get("year"), "|", slr.get("_classification_type"))
```

### Load the overlap matrix and compute coverage statistics
```python
import pandas as pd

df = pd.read_csv(REPO / "data/processed/ss/overlap_matrix.csv")

print(df[["slr_title", "slr_year", "coverage_pct", "eligible_top_n", "hits"]].describe())

# Coverage summary
print(f"Mean coverage:   {df['coverage_pct'].mean():.1f}%")   # 10.5%
print(f"Median coverage: {df['coverage_pct'].median():.1f}%") # 4.4%
print(f"SLRs at 0%:      {(df['coverage_pct'] == 0).sum()}")  # 24
```

### Load ranked results
```python
ranked = json.loads((REPO / "data/processed/ranked_slrs.json").read_text())

# Sort by composite score
ranked.sort(key=lambda r: r["composite"], reverse=True)

for r in ranked[:5]:
    cov = r["raw"]["coverage"]
    print(f"#{r['rank']} {r['slr_title'][:60]} | coverage={cov:.1%} composite={r['composite']:.3f}")
```

### Using the pipeline's paper_key dedup helper
```python
from lib.paperid import paper_key, dedup_by_key

papers = [
    {"doi": "https://doi.org/10.1145/12345", "title": "Example Paper"},
    {"doi": "doi:10.1145/12345", "title": "Example Paper (duplicate)"},
    {"paperId": "abc123", "title": "Another Paper"},
]

unique = dedup_by_key(papers)
print(len(unique))  # 2 — the two DOI variants resolve to the same key
```
