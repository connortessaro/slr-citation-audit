# Report writer handoff

**Purpose:** Single entry point for writing the ~3,000-word report.  
**Audience:** Teammate drafting the final paper.  
**Last updated:** June 2026  
**Data scope:** **Semantic Scholar only.** ACM and IEEE bronze exports exist in the repo but were **not** used for SLR identification, reference extraction, overlap, or reported results in this study.

---

## 1. Elevator pitch

Systematic Literature Reviews (SLRs) claim comprehensive, unbiased coverage of a research area. This study tests a narrower question within the **technical debt** subfield:

> Do published TD reviews actually cite the papers the community treats as most influential?

We identified SLR candidates via Semantic Scholar, extracted their reference lists, built an independent top-cited benchmark (also from Semantic Scholar), and measured **date-controlled coverage** — the proportion of eligible top-cited papers each SLR cites.

**Research questions** (from `report/report.md`):

| RQ | Question |
|----|----------|
| **RQ1** | What proportion of the top-50 most-cited technical-debt papers (with date controls) appears in each published SLR? |
| **RQ2** | Where coverage gaps exist, are they explained by venue type, publication age, open-access status, or DOI block? |
| **RQ3** | What practical implications follow for how SLRs in this subfield should be conducted? |

---

## 2. Start here — file map

| Need | File |
|------|------|
| Report skeleton (~3,000 words) | [`report/report.md`](../report/report.md) |
| Methods prose + headline numbers | [`docs/research_paper_methods_snapshot.md`](research_paper_methods_snapshot.md) |
| SLR inclusion gates + rationale | [`docs/slr_identification_gates.md`](slr_identification_gates.md) |
| Top-50/100 benchmark design | [`docs/top_cited_methodology.md`](top_cited_methodology.md) |
| Classification rubric | [`data/manual/CLASSIFICATION.md`](../data/manual/CLASSIFICATION.md) |
| Per-paper audit trail | [`data/manual/ss/slr_decisions.csv`](../data/manual/ss/slr_decisions.csv) |
| Overlap results | [`data/processed/ss/overlap_matrix.csv`](../data/processed/ss/overlap_matrix.csv) |
| Gap analysis | [`data/processed/ss/gap_analysis.csv`](../data/processed/ss/gap_analysis.csv) |
| Interactive explorer | `python tools/explorer/serve.py` → [`tools/explorer/README.md`](../tools/explorer/README.md) |
| Matplotlib figures | `PYTHONPATH=. python report/build_figures.py --source ss` → `report/figures/ss/` |

**Rule:** Copy numbers from this document or `research_paper_methods_snapshot.md`. Do not use figures from old chat logs — re-run the explorer or pipeline if unsure.

---

## 3. Data scope — Semantic Scholar only

This is important for the Methods and Limitations sections.

| Source | Status in this study |
|--------|---------------------|
| **Semantic Scholar** | **Used end-to-end:** SLR discovery, classification, reference extraction, citation counts, top-cited benchmark, overlap, gap analysis |
| **ACM Digital Library** | Bronze BibTeX exports collected (`data/raw/acm_exports/`) and parsed for traceability. **Not used** in reported overlap or coverage numbers |
| **IEEE Xplore** | Not collected or analyzed for this report |

The pipeline supports per-source silos (`sources/ss/run.py`, `sources/acm/run.py`, etc.), but **all headline results below are SS-only**. Mention ACM/IEEE only as future work or optional cross-validation, not as part of the primary analysis.

---

## 4. Headline results (current SS run)

All numbers verified against `data/processed/ss/` as of June 2026.

### SLR corpus

| Stage | Count |
|--------|------:|
| Raw SS candidates (deduped) | 8,417 |
| Auto-INCLUDE after classification gates | 110 |
| Excluded (no reference list after SS + Crossref) | 50 |
| **Final analysis corpus** | **60** |

**Corpus composition (n = 60):**

| Attribute | Value |
|-----------|-------|
| Publication years | 2015–2026 (**0** from 2000–2014) |
| 2015–2019 | 11 SLRs (18%) |
| 2020–2026 | 49 SLRs (82%) |
| By type | SLR 39, systematic mapping 19, survey 2 |

### Coverage (top-50 benchmark, date-controlled)

| Metric | Value |
|--------|------:|
| Mean coverage | **10.5%** |
| Median coverage | **4.4%** |
| Min / max | 0% / 40% |
| SLRs with **zero** coverage | **24 / 60 (40%)** |
| Missed (SLR, paper) pairs | 1,859 |

### Coverage by SLR cohort

| Cohort | n | Mean | Median |
|--------|--:|-----:|-------:|
| 2015–2019 | 11 | 20.3% | 25.0% |
| 2020+ | 49 | 8.3% | 2.0% |

Lower coverage among newer SLRs is partly **mechanical** — by later publication years more benchmark papers are date-eligible — not only a quality signal.

### Robustness: top-100 benchmark

| Metric | Top 50 | Top 100 |
|--------|-------:|--------:|
| Mean coverage | 10.5% | 8.6% |
| Median coverage | 4.4% | 3.5% |
| Rank-N citation floor | 12 cites (rank 50) | 9 cites (rank 100) |

Headline finding **holds** under a larger benchmark: coverage drops slightly because the denominator grows faster than hits.

### Top-cited benchmark pool

| Metric | Value |
|--------|------:|
| Discovery pool (keyword search, subfield filter) | 958 papers |
| Established pool (year ≤ 2022) | 781 |
| Recent pool (year > 2022) | 177 |
| Citation range (rank 1–50) | 1,437 → 12 |

### Gap characterisation

| Dimension | Top finding | Share of 1,859 missed pairs |
|-----------|-------------|----------------------------:|
| **Venue type** | Journal | 90.4% (1,681) |
| | Unknown | 6.5% (120) |
| | Preprint | 3.1% (58) |
| **Age bucket** | 6–10 years before SLR | 34.8% (647) |
| | 0–2 years before SLR | 32.0% (594) |
| | 3–5 years | 18.5% (343) |
| | 10+ years | 14.8% (275) |
| **Open access** | Missed papers with OA PDF | 43.0% (800) |
| **Top-10 benchmark** | Misses involving rank ≤ 10 papers | 484 pairs |

Use these for filling `report/report.md` placeholders:

- `{{primary_venue_gap}}` → **journal**
- `{{top_missed_venue}}` → **journal**
- `{{top_missed_venue_pct}}` → **90.4%**
- `{{primary_age_bucket}}` → **6–10y** (or discuss dual peak at 6–10y and 0–2y)
- `{{open_access_missed_pct}}` → **43.0%**
- `{{mean_coverage_top100_pct}}` → **8.6%**
- `{{robustness_verdict}}` → **robust** (finding persists under top-100)

---

## 5. Methodology story — why we did it this way

Write the Methods section as a narrative of decisions, not just a procedure list.

### 5.1 Subfield definition

Technical debt = papers whose title or abstract mentions **technical debt**, **code debt**, **design debt**, or **architectural debt** as the primary topic. Config: `config/subfield.yaml`. Full rubric: `data/manual/CLASSIFICATION.md`.

### 5.2 SLR identification (Semantic Scholar)

**Search:** 16 API queries over 2000–2026 — each debt keyword × each review phrase (targeted), plus broad keyword searches with title filter for review phrases. Review phrases include the systematic family plus widened labels (literature review, SLR, survey, scoping review, mapping study, tertiary review, meta-analysis). See `docs/slr_identification_gates.md`.

**Classification gates** (all must hold for auto-INCLUDE):

1. Subfield keyword in title or abstract
2. Secondary-study self-label in title or abstract
3. Publication year in configured bounds (2000–2026)
4. **Bibliography required:** SLRs with no reference list after SS extraction and Crossref backfill are excluded from the analysis corpus

**Three gate changes during the project** (document each with rationale):

| Change | Date | Effect | Doc |
|--------|------|--------|-----|
| Dropped "methodology signal" gate (PRISMA/Kitchenham keywords required in abstract) | May 2026 | 21 → 74 auto-INCLUDE | [`docs/changes/2026-05-28-drop-methodology-signal-gate.md`](changes/2026-05-28-drop-methodology-signal-gate.md) |
| Crossref reference backfill for empty SS reference lists | May 2026 | ~30 SLRs backfilled; 12 still empty | [`docs/changes/2026-05-28-crossref-reference-backfill.md`](changes/2026-05-28-crossref-reference-backfill.md) |
| Widened secondary-study self-labels (literature review, SLR, survey, etc.) | June 2026 | 74 → 110 auto-INCLUDE; corpus stays 60 (50 lack bibliographies) | [`docs/slr_identification_gates.md`](slr_identification_gates.md) |

**Trade-off on widened labels:** `survey` and `literature review` increase recall and may admit narrative reviews without strict protocols. Accepted because (1) the subfield keyword gate removes most off-topic noise, and (2) the research question is bibliographic coverage, not quality appraisal.

### 5.3 Field emergence finding — no pre-2015 TD SLRs

In the SS candidate pool, **1,875** records fall in 2000–2014. **None** pass both subfield and review self-label gates (even after widening). Pre-2015 TD items in the pool are primary studies, workshops, or position papers — not self-labelled reviews. This aligns with manual SS UI searches (~1,880 hits for 2000–2015) and is treated as a **field emergence finding** (~2015 onward), not a pipeline failure.

### 5.4 Top-cited benchmark — two-pass design

Professor feedback outlined several approaches (raw citation count, citations per year, field-normalized FWCI, recent-only ranking). We chose:

- **Semantic Scholar** for citation counts (same source as SLR references — no OpenAlex)
- **Two-pass top-50:** 25 from established (year ≤ 2022) + 25 from recent (2023–2026), each ranked by raw `citationCount`
- **Top-100** parallel list for robustness

**Why not skew benchmark toward recent papers only:** That would change the research question from "cite canonical TD literature" to "cite recent hot papers." The two-pass design balances accumulated influence and recent momentum. See `docs/top_cited_methodology.md`.

### 5.5 Overlap and date control

For each SLR published in year *Y*, only benchmark papers with `publication_year ≤ Y` count as eligible.

```
coverage_pct = (eligible benchmark papers cited in SLR references) / (eligible benchmark papers)
```

Matching uses `paper_key`: DOI → Semantic Scholar id → normalized title (`core/paperid.py`).

### 5.6 Gap explanation

For each `(SLR, missed top-cited paper)` pair, features include: `venue_type`, `year_delta`, `age_bucket`, `open_access`, `in_acm`, `in_ieee`, `is_top10`. Output: `data/processed/ss/gap_analysis.csv`.

---

## 6. Key findings to interpret

Do not just restate numbers — explain what they mean.

1. **Coverage is genuinely low.** Mean 10.5%, median 4.4%. This is a real finding, not purely a pipeline artifact.

2. **But it is multifactorial:**
   - 24/60 SLRs (40%) cite **none** of the eligible top-50 — a strong Discussion point
   - Incomplete reference metadata before Crossref backfill reduced analysable corpus from 110 to 60
   - The benchmark includes papers SLRs may legitimately exclude (e.g. ML "technical debt" papers highly cited but not core TD primary studies)
   - `paper_key` matching may miss title-variant citations

3. **Cohort effect is real and partly mechanical.** 2015–2019 SLRs average 20.3% coverage; 2020+ average 8.3%. Newer SLRs face a larger eligible benchmark set by date control.

4. **Foundational TD SLRs cite better.** e.g. Li JSS prioritization SLR (2021) reaches 36% coverage; many 2024–2026 SLRs sit at 0–4%.

5. **Gap patterns:**
   - **90% of misses are journal papers** — not a conference-visibility story alone
   - **Dual age peak** at 6–10y and 0–2y before SLR publication — both recency penalty and older assumed-known papers
   - **43% of missed papers are open-access** — access barriers alone do not explain most gaps

6. **Coverage ≠ conclusion validity.** A gap in citation coverage does not imply a flawed synthesis. An SLR may legitimately exclude a highly-cited but off-topic paper. The finding is at the level of *input coverage*, not *output validity* (`report/report.md` §4.2).

---

## 7. Report section guide

Map each section of `report/report.md` to source material.

| Section | What to write | Primary sources |
|---------|---------------|-----------------|
| **Abstract** | One-paragraph summary with headline numbers | §4 above |
| **§1 Introduction** | RQs, why technical debt is a good testbed | `report/report.md`, design doc |
| **§2 Method** | Full pipeline; emphasise SS-only scope | §5 above, `research_paper_methods_snapshot.md` |
| **§2.2 SLR identification** | 16 searches, gates, gate changes | `slr_identification_gates.md`, change logs |
| **§2.4 Reference extraction** | SS + Crossref backfill; no-ref exclusion | Crossref change log |
| **§2.5 Top-cited corpus** | Two-pass design + professor rationale | `top_cited_methodology.md` |
| **§2.6 Overlap** | Date control formula | `04_overlap/compute_overlap.py` |
| **§3.1 SLR corpus** | Funnel 8417 → 110 → 60; no pre-2015 finding | §4 above |
| **§3.2 Coverage** | Mean/median/min/max; zero-coverage count; cohort table | `overlap_matrix.csv`, explorer Overview |
| **§3.3 Gap characterisation** | Venue, age, OA findings | `gap_analysis.csv`, gap summary CSVs |
| **§4 Discussion** | Plausible drivers + "what this is not" | §6 above |
| **§5 Implications** | Four recommendations (pre-drafted) | `report/report.md` §5 |
| **§6 Limitations** | SS-only, search cap, classification subjectivity | §8 below |
| **§7 Conclusion** | Restate headline + recommendations | §4 above |

### Placeholders still in `report/report.md`

Fill from §4:

```
{{n_slrs}} = 60
{{n_slrs_raw}} = 8417
{{year_min}} = 2000
{{year_max}} = 2026
{{slr_year_min}} = 2015
{{slr_year_max}} = 2026
{{n_slr_type}} = 39
{{n_sms_type}} = 19
{{mean_coverage_pct}} = 10.5
{{median_coverage_pct}} = 4.4
{{min_coverage_pct}} = 0
{{max_coverage_pct}} = 40
{{n_missed_pairs}} = 1859
{{mean_coverage_top100_pct}} = 8.6
```

---

## 8. Limitations (use/adapt in §6)

- **Single data source:** All discovery, references, and citation counts from Semantic Scholar. ACM and IEEE were not used.
- **Search ceiling:** Top-cited ranking only considers papers in the SS keyword search top 1,000 per query.
- **Benchmark scope:** Limited to papers entering the SS keyword pool; pre-2000 seminal work excluded by `year_min`.
- **No field normalization:** Raw `citationCount`, not OpenAlex FWCI.
- **English-oriented indexing** and metadata gaps (empty bibliographies excluded 50 SLRs).
- **Widened review labels** may admit narrative surveys without documented protocols.
- **Classification subjectivity:** Per-paper justifications in `data/manual/ss/slr_decisions.csv`.
- **Citation counts are point-in-time:** Counts grow over time; date control mitigates eligibility but not ranking volatility.
- **Coverage ≠ validity:** Low coverage does not prove incorrect SLR conclusions.

---

## 9. Sensitivity analyses (discuss in Results or Discussion)

Built into the explorer — cite primary (top-50, all cohort) numbers first, then discuss sensitivities:

| Analysis | How to run | Expected effect |
|----------|------------|-----------------|
| Top-50 vs top-100 | Explorer → Benchmark toggle | Mean drops 10.5% → 8.6%; finding persists |
| SLR cohort 2015–19 vs 2020+ | Explorer → SLR cohort | Older cohort ~2.5× higher coverage |
| Established vs recent benchmark pass | Explorer → Benchmark pass | Isolates which half of benchmark drives misses |
| Top-10 highest-impact misses | Filter `is_top10=True` in gap CSV | 484 missed pairs involve top-10 papers |
| SLR consensus bibliography | Explorer → Top cited → Consensus | What SLRs cite most among themselves |
| Pairwise SLR overlap | Explorer → SLRs → Compare tab | Jaccard similarity between SLR reference sets |

---

## 10. Figures and explorer

### Generate static figures

```bash
PYTHONPATH=. python report/build_figures.py --source ss
```

Output: `report/figures/ss/coverage_histogram.png`, `gap_heatmap.png`.

### Interactive explorer (screenshots for appendix or presentation)

```bash
python tools/explorer/serve.py
```

Opens [http://127.0.0.1:8765/tools/explorer/](http://127.0.0.1:8765/tools/explorer/).

| Page | Use for report |
|------|----------------|
| **Overview** | KPIs, coverage histogram, top-cited bar chart, coverage extremes |
| **SLRs** | Drill into individual SLR hits/misses; zero-coverage examples |
| **Top cited** | Benchmark papers; which SLRs cite each |
| **Methods** | Renders `research_paper_methods_snapshot.md` — consistency check |

**Note:** Explorer recomputes coverage in-browser when toggling settings. Use **default** (Top 50, All cohort, All passes) for primary reported numbers.

---

## 11. Practical recommendations (Discussion §5)

Pre-drafted in `report/report.md` — expand with evidence from gap analysis:

1. **Backward snowballing is non-optional.** Seed from well-known TD papers; catches venue-invisible work keyword search misses.
2. **Citation-aware quality check.** After inclusion criteria, cross-check against a top-N most-cited list; document exclusions.
3. **Multi-source dedup.** Use multiple digital libraries plus a citation-graph source to mitigate single-source gaps. (Our SS-only scope makes this recommendation especially relevant.)
4. **Time-window honesty.** Distinguish "we excluded this paper" from "this paper post-dated our search."

---

## 12. Reproducibility

```bash
# Setup
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp config/subfield.example.yaml config/subfield.yaml
export SEMANTIC_SCHOLAR_API_KEY=...   # optional, raises rate limits
export CROSSREF_MAILTO=you@example.com # optional, Crossref polite pool

# Full SS pipeline
PYTHONPATH=. python sources/ss/run.py

# Or stage-by-stage — see README.md

# Explorer + figures
python tools/explorer/serve.py
PYTHONPATH=. python report/build_figures.py --source ss
```

All code, classifications, and intermediate data live in this repository. Re-running the pipeline should reproduce the numbers above (subject to Semantic Scholar's evolving citation graph).

---

## 13. Out of scope for this report

Do not include in the coursework write-up (separate future-work docs):

- SaaS no-code platform: `docs/plans/2026-05-28-saas-no-code-slr-platform.md`
- ACM/IEEE end-to-end overlap runs
- Per-venue breakdown across publishers
- Node-based pipeline editor / multi-tenant AWS architecture

Mention ACM/IEEE only if noting they were collected but not analysed, or as a limitation / future validation step.

---

## 14. Methodological decision timeline

| When | Decision | Why |
|------|----------|-----|
| May 27 | Pipeline design: 5 stages, SS citation source, N=50 benchmark | Design doc |
| May 28 | Per-source silo architecture (SS/ACM/IEEE data dirs) | Independent analysis per database |
| May 28 | Dropped methodology-signal gate | Too many false negatives (21 SLRs) |
| May 28 | Crossref backfill for empty SS refs | SS API often returns no reference list |
| May 28 | Extended year range to 2000–2026 | Capture field emergence |
| June | Two-pass top-50 (established + recent) | Professor feedback; balance old + new influence |
| June | Top-100 robustness list | Sensitivity analysis |
| June | Widened SLR self-label gates | Pre-2015 pool has TD papers but not self-labelled reviews |
| June | Prune SLRs with no bibliography | Coverage undefined without refs; corpus 110 → 60 |
| June | Explorer with live benchmark/cohort toggles | Interactive sensitivity for paper + presentation |
| June | **Report scope locked to SS only** | ACM/IEEE not used in final analysis |

---

## 15. Quick checklist for the report writer

- [ ] Read `report/report.md` skeleton end-to-end
- [ ] Replace all `{{placeholders}}` with numbers from §4 and §7
- [ ] State clearly in Methods: **Semantic Scholar only**; ACM/IEEE not used
- [ ] Explain the 8417 → 110 → 60 funnel and why 50 were dropped (no bibliography)
- [ ] Explain no pre-2015 SLRs as field emergence, not pipeline failure
- [ ] Explain two-pass benchmark design and why not recent-only
- [ ] Report zero-coverage SLRs (24/60) as a headline finding
- [ ] Discuss cohort effect (2015–19 vs 2020+) with mechanical vs quality interpretation
- [ ] Include gap findings: journal dominance, dual age peak, 43% OA
- [ ] Run robustness: top-100 mean 8.6% — finding holds
- [ ] Include limitations from §8
- [ ] Generate figures via `build_figures.py` or explorer screenshots
- [ ] Do **not** claim ACM/IEEE overlap results as part of this study
