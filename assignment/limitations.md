# Limitations

## 1. Data Limitations

### SLR corpus identification

The corpus was built exclusively from Semantic Scholar API searches (16 queries crossing subfield keywords with secondary-study labels). ACM BibTeX exports were parsed into `data/raw/acm_slr_candidates.json` but zero entries made it into the final corpus; IEEE was never ingested. Every record in the analysis corpus has `source: "ss"`. This means:

- Papers indexed poorly or not at all by Semantic Scholar (e.g. certain workshop proceedings, non-English venues) are absent from the candidate pool regardless of relevance.
- The search queries are keyword-driven; SLRs that use adjacent terminology ("software debt", "design erosion") without the trigger phrases are missed.
- The classification gate was widened to accept *survey* and *literature review* labels alongside *systematic ...*; earlier versions of the pipeline excluded some legitimate SLRs on wording alone. The final corpus reflects that widened gate and may not match the strict SLR definition used in other audit studies.
- Non-English SLRs were excluded by the classification rubric. Their citation patterns are unknown.

### Canonical benchmark construction

The top-50 benchmark uses a **two-pass design**: the discovery pool (Semantic Scholar keyword search, up to 1,000 results per query) is split at a cutoff year (2022), and the top 25 papers by `citationCount` are taken from each cohort — 25 "established" (year ≤ 2022) and 25 "recent" (year > 2022). This is documented in `docs/top_cited_methodology.md`. Citation count is not the same as importance, correctness, or methodological quality. Specifically:

- A paper cited heavily for being wrong, limited, or superseded still enters the benchmark.
- Within each pass, ranking is still by raw citation count. The established pass still favors papers with more time to accumulate citations relative to others in the same cohort.
- The discovery pool is capped at 1,000 results per keyword query. Papers that are highly cited but fall outside that top-1,000 window for every query cannot enter the benchmark, regardless of their actual citation count.
- Raw counts are not field-normalized (no FWCI or equivalent). Papers in high-volume citation venues are advantaged.
- The cutoff year (2022) is a fixed parameter, not derived from the data. A different cutoff would produce a different benchmark.

### Reference extraction completeness

Reference lists come from Semantic Scholar's `/paper/{id}/references` endpoint with a Crossref fallback and a Playwright scraper for Elsevier. Coverage is not guaranteed:

- Semantic Scholar does not index all published references. Some references for a given SLR may simply be absent from the API response with no error signal.
- The Crossref fallback resolves DOI-level metadata but depends on DOIs being registered and correctly linked.
- SLRs whose reference list was empty after both sources were dropped from the analysis corpus (50 of 110 auto-INCLUDEs). Those 50 are not a random sample — they are likely the worst-indexed SLRs, which means the analysis corpus skews toward better-indexed venues. Coverage estimates are probably optimistic relative to the full population of SLRs.

### Scope and generalizability

- The study covers one subfield (technical debt). Findings about mean coverage, gap patterns, and age distribution are specific to this literature and should not be generalized to software engineering SLRs at large, or to SLRs in other fields.
- Only English-language publications were included.
- The SLR tradition in this subfield begins around 2015; the pre-2015 candidate pool yielded zero qualifying SLRs. The findings therefore describe a relatively young secondary literature.

### Publication bias and access

- Paywalled papers are fully present in the benchmark and in SLR reference lists, but the reference lists themselves are only as complete as what SS and Crossref return. There is no mechanism to recover references from full-text PDFs for most SLRs.
- 43% of missed benchmark papers had an open-access PDF at analysis time, so paywall access explains only a limited share of the gap — but some of those papers may have been paywalled at the time the SLR was written.

---

## 2. Analysis Limitations

### Paper key matching

Matching uses a three-tier priority chain: DOI → Semantic Scholar paperId → normalized title (`lib/paperid.py`). Title-based matching (the fallback) strips punctuation, diacritics, and case, but:

- Slightly different titles across databases (e.g. subtitle truncation, hyphenation differences) produce different normalized keys and count as misses even when they refer to the same paper.
- Very short or generic titles can produce false matches between unrelated papers.
- The fallback triggers only when both DOI and SS paperId are absent, so it is relatively rare — but it is the most error-prone tier.

### Citation-count bias toward older papers

Even with the two-pass design, the established-pass benchmark (25 papers, year ≤ 2022) is still biased toward older work: a 2015 paper has had more time to accumulate citations than a 2021 paper. The recent-pass (25 papers, 2023–2026) partially compensates, but the overall top-50 list is not age-neutral. SLRs from earlier cohorts face a smaller eligible set, and that set happens to be the one they had the best chance of knowing. This mechanically inflates coverage scores for older SLRs and deflates them for newer ones — the cohort effect observed in §3.2 is partly an artifact of this structure.

### Single embedding model

Semantic similarity scores use Qwen3 embeddings via sentence-transformers. A different model (e.g. SPECTER2, OpenAI text-embedding-3-large) would produce different cosine similarity values and potentially different ordinal rankings on that dimension. The relative ordering of SLRs on the semantic dimension is model-dependent.

---

## 3. Mitigations Undertaken

The following design choices were made specifically to reduce known failure modes:

- **Date control** — benchmark papers are filtered to year ≤ SLR year before computing coverage, so SLRs cannot be penalized for missing papers that did not exist when they were written (`04_overlap/date_controls.py`).
- **Three-tier dedup chain** — DOI → SS paperId → normalized title reduces false non-matches when a paper appears under slightly different metadata across sources (`lib/paperid.py`).
- **SS API search breadth** — 16 keyword queries (4 debt terms × 4 review phrases) plus broad passes reduce the chance that a qualifying SLR is missed due to any single query's result cap.
- **Crossref + Playwright fallbacks** — where SS returns empty reference lists, Crossref is queried by DOI; Elsevier papers additionally get a Playwright-based scraper for Appendix B reference sections, reducing the number of SLRs dropped for missing bibliographies.
- **Manual override hook** — `data/manual/slr_decisions.csv` supports an `override` column so classification errors caught by hand review can be corrected without re-running the automated pipeline.
- **Two-pass top-cited benchmark** — splitting the benchmark into established (≤2022) and recent (2023–2026) passes mitigates pure age-bias in the citation ranking, rather than using a single lifetime-citation sort.

