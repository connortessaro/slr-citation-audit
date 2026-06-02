# Methods and corpus snapshot (Semantic Scholar run)

*Draft text for the research paper and explorer **Methods** tab. Generated from pipeline outputs; re-run overlap after refreshing data and update numbers if needed.*

---

## 1. Research focus

- **Subfield:** technical debt (keywords: technical debt, code debt, design debt, architectural debt).
- **Question:** Do technical-debt systematic reviews and related secondary studies cite the literature the community treats as most influential?
- **Primary data source (current results):** Semantic Scholar (SS) for SLR discovery, reference lists, and citation counts.
- **ACM / IEEE:** ACM bronze exports parsed (71 candidates); not merged into overlap results in this snapshot.

---

## 2. SLR identification (Semantic Scholar)

### Search

- **16 API searches** over 2000-2026: each debt keyword × each review phrase (targeted), plus broad keyword searches with title filter for review phrases.
- Review phrases include systematic family plus widened labels: literature review, SLR, survey, scoping review/study, mapping study, tertiary review/study, meta-analysis (see `docs/slr_identification_gates.md`).
- Raw candidates (deduped): **8,417**.

### Classification gates

1. Subfield keyword in title or abstract.
2. Secondary-study self-label in title or abstract (patterns above).
3. Publication year in configured bounds (2000-2026).
4. **Bibliography required:** SLRs with no reference list after SS extraction and Crossref backfill are excluded from the analysis corpus.

### Counts

| Stage | Count |
|--------|------:|
| Raw SS candidates | 8,417 |
| Auto-INCLUDE after gates | 110 |
| Final corpus (with references) | **60** |
| Excluded (no reference list) | 50 |

### SLR corpus composition (n = 60)

**Publication years:** 2015-2026 (**0** from 2000-2014 in the final corpus).

| Year band | SLRs | Share |
|-----------|-----:|------:|
| 2015-2019 | 11 | 18% |
| 2020-2026 | 49 | 82% |

**By type:** SLR 39, systematic mapping 19, survey 2.

### Finding: no pre-2015 TD SLRs

In the SS candidate pool, **1,875** records fall in 2000-2014. **None** pass both subfield and review self-label gates (even after widening). Pre-2015 TD items in the pool are primary studies, workshops, or position papers-not self-labelled reviews. This aligns with manual SS UI searches (~1,880 hits for 2000-2015) and is treated as a **field emergence** finding (~2015 onward), not a pipeline failure.

---

## 3. Top-cited benchmark

### Purpose

Define influential **primary** (and synthesis) technical-debt papers SLRs should be expected to cite. Distinct from the SLR corpus: the benchmark **includes older seminal work** via the “established” pass.

### Method (primary: N = 50)

- **Source:** Semantic Scholar `citationCount`.
- **Discovery pool:** keyword search (≤1,000 hits per keyword, relevance order), subfield filter on title/abstract → **958** papers.
- **Two-pass selection** (see `docs/top_cited_methodology.md`):

| Pass | Eligibility | Quota (N=50) |
|------|-------------|-------------|
| Established | year ≤ 2022 (as-of 2026, 4-year window) | 25 |
| Recent | year > 2022 | 25 |

| Metric | Value |
|--------|------:|
| Established pool / Recent pool | 781 / 177 |
| Citation range (rank 1-50) | 1,437 → 12 |

**Robustness:** N = 100 (50 + 50 two-pass); rank 100 ≈ 9 citations.

**Not used:** OpenAlex field-weighted impact (FWCI); title-only TD filter.

### Design choice: not “recent-only” benchmark

Skewing the benchmark toward recent papers would raise coverage for newer SLRs but change the research question from “cite canonical TD literature” to “cite recent hot papers.” The two-pass design balances accumulated influence and recent momentum without abandoning older highly cited work.

---

## 4. Overlap and coverage

For each SLR, **date control:** only benchmark papers with `publication_year ≤ SLR year` count as eligible.

**Coverage** = (eligible benchmark papers cited in SLR references) / (eligible benchmark papers).

### Results (top-50 benchmark, n = 60 SLRs)

| Metric | Value |
|--------|------:|
| Mean coverage | 10.5% |
| Median coverage | 4.6% |
| Min / max | 0% / 40% |
| Missed (SLR, paper) pairs | 1,859 |

### By SLR cohort

| Cohort | n | Mean coverage | Median |
|--------|--:|-------------:|-------:|
| 2015-2019 | 11 | 20.3% | 25.0% |
| 2020-2026 | 49 | 8.3% | 2.0% |

Lower coverage among newer SLRs is partly **mechanical** (more eligible benchmark papers exist by later SLR years), not only review quality.

---

## 5. ACM Digital Library (bronze)

| Stage | Count |
|--------|------:|
| Raw BibTeX entries | 467 |
| Candidates after filter + dedup | 71 |
| Years in candidates | 2015-2026 only |
| Would INCLUDE (widened gates, simulated) | 25 |
| Overlap with SS corpus | 10 |
| ACM-only (not in SS corpus) | 15 |
| Pre-2015 TD SLRs | 0 |

ACM exports used narrow queries: `"<debt keyword>" AND (systematic review OR …)`. Pipeline not run end-to-end for ACM overlap in this snapshot.

---

## 6. Sensitivity analyses (recommended in paper)

1. **Top-50 vs top-100** benchmark (explorer supports live toggle).
2. **SLR cohort:** 2015-19 vs 2020+ (explorer cohort filter).
3. **Two-pass vs single global citation rank** (compare list overlap).
4. **Top-10 subset** for “highest-impact” misses (`is_top10` in gap analysis).

---

## 7. Limitations

- Semantic Scholar search cap (1,000 results per keyword).
- Benchmark limited to papers entering the SS keyword pool.
- Single citation database (SS).
- English-oriented indexing and metadata gaps (empty bibliographies).
- Widened review labels may admit narrative surveys without strict protocols.
- SS-only overlap in reported numbers; ACM/IEEE not merged.

---

## 8. Explorer dashboard

The overlap explorer (`tools/explorer/`) supports:

- **Benchmark size:** top 50 vs top 100 (live recomputed coverage).
- **SLR cohort:** all, 2015-2019, 2020+.
- **Top-cited pass filter:** established / recent / all.
- **Methods tab:** this document.

Re-run `04_overlap/compute_overlap.py` after changing pipeline outputs; the explorer recomputes coverage from JSON + references when settings change.
