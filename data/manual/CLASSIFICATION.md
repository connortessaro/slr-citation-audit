# SLR Classification Rubric

**Purpose:** Decide whether each candidate paper is a *Systematic Literature Review* (SLR), and therefore eligible for the corpus, or a different artefact that must be excluded.

This rubric is applied by the assistant (no user review step). Decisions and per-paper justifications are recorded in `slr_decisions.csv`.

## Definitions

- **Systematic Literature Review (SLR):** A secondary study following a documented protocol — explicit research questions, defined search strategy across digital libraries, inclusion/exclusion criteria, and a structured synthesis. Typically follows Kitchenham & Charters (2007) or PRISMA guidelines.
- **Systematic Mapping Study (SMS):** Closely related: also protocol-driven, but optimized for classification and breadth rather than synthesis. **Included** in this corpus, because mapping studies are part of the SLR-family literature.
- **Survey (narrative):** Broad overview without a documented protocol. **Excluded.**
- **Tertiary review:** SLR of SLRs. **Included only if** the unit of analysis is technical debt primary studies (not other SLRs).

## Inclusion criteria (ALL must hold)

1. **Subfield fit:** title, abstract, or keywords mention "technical debt", "code debt", "design debt", or "architectural debt", and the paper is *about* technical debt as the primary topic (not a paper that merely cites the term in passing).
2. **Study type (automated):** title or abstract matches a pattern in `config/subfield.yaml` `slr_title_patterns` (systematic review family, literature review, SLR, survey, scoping review, mapping study, tertiary review, meta-analysis, etc.). See `docs/slr_identification_gates.md` for the widened list and rationale. **Note:** the pipeline does not require protocol keywords in the abstract for auto-inclusion (narrative surveys may pass if they self-label as a survey/review and mention technical debt).
3. **Year:** publication year within `config/subfield.yaml` `year_min`–`year_max`.
4. **Venue type:** peer-reviewed conference, journal, or workshop. Theses, technical reports, and preprints excluded unless cited heavily (≥50 citations on Semantic Scholar) — record in justification.
5. **Language:** English. Non-English studies excluded and noted in limitations.

## Exclusion examples

| Title pattern | Decision | Reason |
|--------------|----------|--------|
| "A Survey of …" with TD focus | INCLUDE (type=survey) | Wider self-label gate; may lack strict protocol |
| "Technical Debt: An Overview" | EXCLUDE | Editorial / opinion |
| "A Systematic Literature Review of Refactoring" | EXCLUDE | Wrong subfield |
| "Systematic Mapping of Technical Debt Management" | INCLUDE | SMS, in scope |
| "Tools for Detecting Technical Debt: An SLR" | INCLUDE | SLR, in scope |
| "SLR of SLRs on Software Quality" (tertiary, not TD) | EXCLUDE | Tertiary off-topic |

## Decision procedure

For each candidate paper:

1. **Auto-flag:** assistant marks as `auto_slr=true` if title contains any pattern in `slr_title_patterns`.
2. **Subfield check:** assistant grep abstract for any `keywords` entry.
3. **Methodology check:** assistant reads abstract for explicit protocol language ("search string", "databases", "inclusion criteria", "PRISMA", "Kitchenham").
4. **Verdict:** `INCLUDE` if criteria 1–5 all satisfied; `EXCLUDE` otherwise.
5. **Justification:** one-sentence reason recorded in `slr_decisions.csv`.

## Edge cases

- **Update/revised SLRs of an earlier SLR:** include both (treated independently for overlap analysis).
- **Multi-vocal literature reviews (MLRs):** include if peer-reviewed; mark `type=mlr` for sensitivity analysis.
- **Industry whitepapers, gray literature:** exclude unless cited like primary research (≥50 SS citations).

## Recording schema (`slr_decisions.csv`)

| Column | Type | Notes |
|--------|------|-------|
| paper_key | str | Output of `lib.paperid.paper_key` |
| title | str | Paper title |
| year | int | Pub year |
| venue | str | Venue name |
| source | str | `semanticscholar` / `acm` / `ieee` |
| verdict | str | `INCLUDE` / `EXCLUDE` |
| reason | str | One-sentence justification |
| type | str | `slr` / `sms` / `mlr` / `tertiary` (only if INCLUDE) |
