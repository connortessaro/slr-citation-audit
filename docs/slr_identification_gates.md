# Secondary-study identification gates

How we decide whether a Semantic Scholar (or ACM/IEEE) candidate belongs in the **SLR analysis corpus**.

## Why the gates exist

The audit asks whether **secondary studies** (reviews that synthesize prior work) cite the **top-cited technical-debt primary literature**. We must separate:

- True TD reviews (in scope)
- Primary empirical papers that mention “technical debt” (out of scope)
- Reviews in other fields that happen to match a loose search (out of scope)

## Two-layer filter

| Layer | Rule | Purpose |
|-------|------|---------|
| **Subfield** | Title or abstract contains `technical debt`, `code debt`, `design debt`, or `architectural debt` | Keeps the topic fixed on technical debt |
| **Study type** | Title or abstract contains a configured **secondary-study self-label** (see `slr_title_patterns` in `config/subfield.yaml`) | Ensures the paper presents as a review, not a single empirical study |

Publication year must fall in `year_min`-`year_max`. SLRs with **no extractable reference list** after Semantic Scholar + Crossref are dropped later (`02_extract_refs/prune_empty_ref_slrs.py`).

## Widened self-labels (June 2026)

**Original gates** required explicit *systematic* wording (`systematic literature review`, `systematic review`, `systematic mapping`). That aligned with strict Kitchenham-style SLRs but **under-counted older and alternately worded TD syntheses**:

- Many pre-2015 candidates in the SS pool mentioned technical debt but not “systematic …” in title/abstract.
- Authors often write **literature review**, **SLR**, or **survey** without the word *systematic*, especially before TD mapping studies became common (~2015).

We expanded `slr_title_patterns` to include:

| Pattern group | Examples | Rationale |
|---------------|----------|-----------|
| Systematic (unchanged) | systematic literature review, systematic mapping study | Core SLR/SMS family |
| General review | literature review, scoping review, scoping study | Captures reviews that omit “systematic” |
| Mapping | mapping study | SMS variants |
| Abbreviation | slr, slrs | Matches titles like “… An SLR” (token match, not substring) |
| Broader synthesis | survey, tertiary review, tertiary study, meta-analysis | Surveys and tertiary work that still self-identify as syntheses |

**Trade-off:** `survey` and `literature review` increase recall and may admit **narrative** reviews without a documented protocol. We accept that risk for this coursework audit because (1) the **subfield keyword** gate still removes most off-topic SS noise, and (2) the research question is bibliographic coverage (“do reviews cite influential TD papers?”), not quality appraisal of review methodology. Narrative surveys that cite poorly are still informative for RQ1.

**Not included:** bare “review” (too noisy), “overview”, “tutorial”, or protocol-only terms without a study-type label.

## Implementation

- Matching logic: `core/slr_labels.py` (`matches_review_label`, `infer_study_type`)
- Classification: `01_identify_slrs/classify_slrs.py`
- SS broad search pre-filter: `01_identify_slrs/search_semantic_scholar.py` (title must match a pattern; abstract allowed at classify time)

Re-applying classification on the existing candidate JSON **does not require** new API calls. A full re-search adds targeted queries for each new pattern × keyword (see `planned_searches()`).

### Effect on the current SS run (June 2026)

Re-classifying the existing 8,417 SS candidates with widened patterns increased auto-**INCLUDE** from 74 to **110**, but **50** of the new inclusions still had no Semantic Scholar/Crossref bibliography and were pruned. The analysis corpus remains **60** SLRs (still **0** from 2000-2014): early TD papers in the pool are primary studies or workshops, not self-labelled reviews. The gate change mainly affects metadata (`type=survey` etc.) and future searches, not the size of the current overlap run.

## Study types stored on the corpus

`_classification_type` on each included paper:

| Value | Typical trigger |
|-------|-----------------|
| `slr` | Default / systematic literature review |
| `sms` | systematic mapping / mapping study in title |
| `scoping` | scoping review/study |
| `tertiary` | tertiary review/study |
| `survey` | survey in title without “systematic” |
| `meta-analysis` | meta-analysis in title |

## Manual overrides

`data/manual/<source>/slr_decisions.csv` can force `override_verdict` per `paper_key`. Re-running `classify_slrs.py` preserves overrides.
