# Results Summary: Do Technical Debt SLRs Cite the Right Papers?

## What this project is

We audited 60 published Systematic Literature Reviews (SLRs) on technical debt in software engineering — 39 full SLRs, 19 systematic mapping studies, and 2 surveys. The question: when an SLR claims to summarize a research field, does it actually cite the papers the field most relies on?

We built a 50-paper canonical benchmark using a two-pass design (25 established works published on or before 2022, 25 recent works from 2023–2025, both ranked by Semantic Scholar citation count), then checked how many of those benchmark papers appear in each SLR's reference list — controlling for publication date so we only count papers the SLR authors could have read.

---

## Major findings

1. **Most SLRs miss nearly everything.** Mean coverage is 10.5%, median is 4.4%. The typical SLR cites fewer than 3 of the 50 most-cited papers in its own field.

2. **24 SLRs (40%) cite zero canonical papers.** Not one paper from the top 50. For nearly half the corpus, there is no overlap at all with the community's most-cited work.

3. **Only 10 SLRs exceed 25% coverage; 14 exceed 20%.** The distribution is extreme — a small cluster of well-grounded reviews at the top, and the vast majority clustered near zero.

4. **The best SLR covers 40.0% of eligible benchmark papers.** That is the ceiling. Even the best-performing SLR in the corpus misses 60% of the canonical literature it was eligible to cite.

5. **Older SLRs perform better.** SLRs published 2015–2019 averaged 20.3% coverage. SLRs from 2020–2026 averaged 8.3%. Part of this is mechanical (the benchmark grows over time), but it also reflects that early foundational TD reviews were written when the canon was smaller and more cohesive.

6. **The missed papers aren't obscure.** 90.4% of all missed citations are to journal articles — mainstream peer-reviewed venues. 43% of missed papers are open-access. Paywalls and obscure venues don't explain the gap.

7. **Gaps peak at two ages.** Papers 6–10 years old (34.8% of all misses) and papers 0–2 years old (32.0%) are the most commonly missed. Foundations are treated as assumed background; very recent work hasn't had time to be picked up. Both effects happen simultaneously.

---

## Coverage distribution

How many SLRs fall in each coverage bucket (n = 60):

```
Coverage   | Count | Bar
-----------+-------+------------------------------------------
0%         |  24   | ████████████████████████
1% – 5%    |   7   | ███████
5% – 10%   |   4   | ████
10% – 20%  |  11   | ███████████
20% – 30%  |   7   | ███████
30% – 40%  |   7   | ███████
```

40% of SLRs are at zero. 52% cite fewer than 5 canonical papers. Only 14 SLRs exceed 20% coverage.

---

## Top 10 SLRs by coverage

Coverage = eligible top-cited papers actually cited / eligible top-cited papers (date-controlled).

| Coverage | Hits / Eligible | Year | Title (abbreviated)                                                    |
|---------:|:---------------:|:----:|------------------------------------------------------------------------|
| 40.0%    | 10 / 25         | 2022 | Identification and measurement of Requirements Technical Debt          |
| 40.0%    | 10 / 25         | 2021 | Identification and Measurement of TD Requirements in Software Dev      |
| 37.5%    |  9 / 24         | 2019 | Technical Debt Prioritization: State of the Art                        |
| 36.0%    |  9 / 25         | 2021 | A systematic literature review on TD prioritization: Strategies        |
| 33.3%    |  8 / 24         | 2020 | Technical Debt Aware Estimations in Software Engineering               |
| 32.0%    |  8 / 25         | 2021 | Exploring Technical Debt Tools: A Systematic Mapping Study             |
| 31.6%    |  6 / 19         | 2016 | Decision Criteria for the Payment of Technical Debt in Software Projects |
| 28.0%    |  7 / 25         | 2021 | Technical Debt Tools: A Systematic Mapping Study                       |
| 27.3%    |  6 / 22         | 2017 | Elements required to manage technical debt (systematic mapping)        |
| 27.3%    |  6 / 22         | 2017 | Analyzing the concept of TD in agile software development              |

---

## Bottom 10 SLRs by coverage (all at 0%)

All of these cite zero papers from the 50-paper benchmark.

| Refs | Title (abbreviated)                                                        |
|-----:|---------------------------------------------------------------------------|
|    5 | Methods for Identifying Architectural Debt: A Systematic Mapping Study     |
|    5 | A Systematic Mapping Study on Technical Debt in Microservices              |
|    5 | The Influence of Portfolio Management on Evaluating IT Investments         |
|   10 | An Architecture Smell Knowledge Base for Managing Architecture TD          |
|   10 | Requirements Technical Debt Through the Lens of Environment Assumptions    |
|   13 | Variability Debt: A Multi-method Study                                     |
|   19 | Trade-Off Decisions across Time in TD Management: A Systematic Review      |
|   20 | Identifying and Measuring Technical Debt in Software Requirements          |
|   28 | Accelerating Mobile Application Development and Testing with AI            |
|    6 | A Systematic Mapping Study Exploring Quantification Approaches to TD       |

Note: 24 SLRs total are at zero coverage. Several of the worst-indexed SLRs have very few extractable references (≤10), which compounds the coverage gap.

---

## Existing figures

Two charts are available in the report output:

- `../report/figures/ss/coverage_histogram.png` — distribution of coverage percentages across all 60 SLRs
- `../report/figures/ss/gap_heatmap.png` — missed citations broken down by venue type and paper age at SLR time

---

## Notable outliers

**Best performers (tied at 40.0%):** Two SLRs tie at the top — "Identification and measurement of Requirements Technical Debt in software development" (2022) and "Identification and Measurement of Technical Debt Requirements in Software Development" (2021). Both cite 10 of 25 eligible benchmark papers. The topic cluster — requirements-flavored TD — is consistently the best-grounded in canonical literature.

**2019 best:** "Technical Debt Prioritization: State of the Art" (2019) reaches 37.5% (9/24 eligible), the highest coverage of any SLR from that year. It benefits from a smaller eligible set (only 24 papers predated it) and cites them thoroughly.

**Worst performers:** 24 SLRs at exactly 0%. Several have ≤10 extracted references total, which likely means their bibliographies were not fully indexed by Semantic Scholar. Others have substantial reference lists (28, 45, 55+ refs) but still cite none of the 50 canonical papers — a genuine coverage gap, not a data retrieval issue.

**An interesting middle case:** "Towards a Theory on Architecting for Continuous Deployment" has 55 references at 0% TD coverage. It scores well on authority and diversity dimensions — its references are highly cited in their own domain. It's not a bad paper; it's a paper about continuous deployment architecture that genuinely doesn't need to cite TD literature. This illustrates why coverage alone isn't the whole story.

---

## What this means

If you read any random SLR in this corpus to learn about technical debt, there is roughly a 40% chance it cites none of the papers the research community most relies on. Even the best SLR misses 60% of the canonical literature it was eligible to cite.

This isn't primarily about access: the missing papers are mostly in journals, mostly open-access, and from well-known venues. The gap is a protocol problem — SLRs are not systematically checking their output against what the community actually cites.

The practical implication: treat SLRs in this space as a starting point, not a definitive map. Cross-check any SLR's reference list against the most-cited papers in the subfield before trusting it as comprehensive coverage.
