# slr.audit

[![CI](https://github.com/connortessaro/slr-citation-audit/actions/workflows/tests.yml/badge.svg)](https://github.com/connortessaro/slr-citation-audit/actions/workflows/tests.yml)
[![Live](https://img.shields.io/badge/live-web--liard--zeta--83.vercel.app-00ff88?logo=vercel&logoColor=white)](https://web-liard-zeta-83.vercel.app)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

![Python](https://img.shields.io/badge/python-3.12-3776ab?logo=python&logoColor=white)
![Next.js](https://img.shields.io/badge/next.js-16-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/typescript-5-3178c6?logo=typescript&logoColor=white)
![Tailwind](https://img.shields.io/badge/tailwind-v4-38bdf8?logo=tailwindcss&logoColor=white)
![React Three Fiber](https://img.shields.io/badge/r3f-three.js-000000?logo=three.js&logoColor=white)

> Grading 60 published systematic literature reviews on whether they
> actually cite the field they claim to review.
>
> **Average grade: 10.5%. Half cite under 5%. 24 cite zero.**

[![slr.audit hero](https://img.shields.io/badge/click_to_explore-→_web--liard--zeta--83.vercel.app-181818?style=for-the-badge)](https://web-liard-zeta-83.vercel.app)

---

## 🔗 Quick links

| | |
|---|---|
| 🌐 **Live site** | https://web-liard-zeta-83.vercel.app |
| 🎯 **About** | [/about](https://web-liard-zeta-83.vercel.app/about) - why this exists |
| 🛠️ **Method** | [/method](https://web-liard-zeta-83.vercel.app/method) - 6-stage pipeline |
| 🪐 **3D graph** | [/graph](https://web-liard-zeta-83.vercel.app/graph) - citation network |

---

## 🎯 Why this exists

When researchers want to learn about a field they don't already work in,
they reach for a **systematic literature review** - an SLR. The pitch is
simple: somebody else read all the important papers, weighed the evidence,
and wrote it up. The SLR becomes the shortcut.

This site asks: **when an SLR claims to summarize a field, does it actually
cite the field it claims to summarize?**

For one field (technical debt in software engineering) the answer is
**mostly no**. The audit grades every published SLR on what percentage of
the 50 most-cited papers in the same field it actually cited.

---

## ⚡ Quick start

```bash
git clone https://github.com/connortessaro/slr-citation-audit
cd slr-citation-audit

# pipeline
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # add SEMANTIC_SCHOLAR_API_KEY + OPENROUTER_API_KEY

# website
cd web
pnpm install
pnpm dev          # http://localhost:3000
```

---

## 🏗️ How it works (6 stages)

| # | Stage | Reads | Writes | Purpose |
|---|---|---|---|---|
| 1️⃣ | `01_identify_slrs/` | SS API, ACM/IEEE BibTeX | `slr_corpus.json` | Find + classify SLR candidates |
| 2️⃣ | `02_extract_refs/` | corpus | `slr_references.json` | Pull each SLR's reference list |
| 3️⃣ | `03_top_cited/` | SS subfield query | `top_cited_techdebt.json` | Build the 50-paper required-reading list |
| 4️⃣ | `04_overlap/` | refs + top-cited | `overlap_matrix.csv` | Date-controlled coverage % per SLR |
| 5️⃣ | `05_explain_gaps/` | overlap + metadata | `gap_analysis.csv` | Venue / year / access reasons for misses |
| 6️⃣ | `06_rank/` | corpus + refs + overlap + metadata | `ranked_slrs.json` | 5-dim composite rank |

### 🏅 The 5-dimension ranker

Min-max normalized per dimension, weighted sum (default equal 0.2 each):

1. 📚 **Coverage** - % of the 50 required-reading papers this SLR cited
2. 🧠 **Semantic** - mean cosine similarity between SLR vector and reference vectors (Qwen3-Embedding-0.6B)
3. 🏛️ **Authority** - mean `log(1 + citationCount)` of references
4. 🌐 **Diversity** - Shannon entropy of venues + first authors
5. 🤖 **LLM judge** - rubric scoring via OpenRouter (DeepSeek / owl-alpha), temperature 0, cached

---

## 🧪 Stack

| Layer | Tech |
|---|---|
| **Pipeline** | Python 3.12 · Semantic Scholar SDK · `dotenv` · `tqdm` |
| **Embeddings** | `sentence-transformers` + `Qwen3-Embedding-0.6B` (MPS on Mac) |
| **Ranker** | `pandas` · `networkx` · `pydantic` |
| **LLM judge** | OpenRouter (owl-alpha + qwen fallbacks) · file cache · temp 0 |
| **Frontend** | Next.js 16 (App Router) · React 19 · TypeScript · Tailwind v4 · Motion v12 |
| **3D** | React Three Fiber · drei · 3d-force-graph (vanilla Three.js) |
| **Type** | Geist Sans · Geist Mono · Iowan Old Style serif body |
| **Deploy** | Vercel (auto-builds on push to `main`, root dir `web/`) |
| **Tests** | `pytest` (pipeline) · Playwright (web smoke) |

---

## 📁 Project structure

```
slr-citation-audit/
├── 01_identify_slrs/      ← Stage 1: find SLR candidates
├── 02_extract_refs/       ← Stage 2: pull bibliographies
├── 03_top_cited/          ← Stage 3: build required-reading list
├── 04_overlap/            ← Stage 4: coverage matrix
├── 05_explain_gaps/       ← Stage 5: gap analysis
├── 06_rank/               ← Stage 6: composite ranker
│   ├── embed.py           ← sentence-transformers pass
│   ├── judge.py           ← LLM rubric scoring
│   └── rank.py            ← pure scoring functions (testable)
├── lib/                   ← shared (SS client, paper_key dedup, config)
├── data/
│   ├── raw/               ← API dumps (gitignored)
│   ├── processed/         ← pipeline outputs (tracked)
│   └── manual/            ← manual classification CSVs
├── tests/                 ← pytest suite
├── web/                   ← Next.js frontend
│   ├── app/               ← routes
│   ├── components/        ← React components
│   └── lib/data.ts        ← static loader (reads ../data/processed/*)
└── .github/workflows/     ← CI
```

---

## 🌐 Routes

| Route | What it shows |
|---|---|
| `/` | Hero, big stat, route index, most-cited callout, distribution histogram, full SLR table sorted by composite rank |
| `/about` | Why this audit exists + caveats + a guided tour |
| `/slrs/[id]` | Per-SLR coverage gauge, hit list, miss list, full bibliography, 5-dim rank breakdown with AI judge's justification |
| `/papers/[id]` | Per-paper SLR recall - which SLRs cite it vs miss it (date-eligible) |
| `/consensus` | Most-cited papers across all SLR bibliographies (whether on the required list or not) |
| `/compare` | Pairwise reference overlap between any two SLRs |
| `/graph` | 3D citation network (R3F + 3d-force-graph) |
| `/method` | Full pipeline writeup |

---

## ✅ Tests

```bash
pip install -r requirements-dev.txt
pytest -q                  # pipeline
cd web && pnpm test        # Playwright smoke
```

CI runs on every push / PR. Pure scoring functions in `06_rank/rank.py`
have no I/O and are the natural place to add new tests.

---

## 🔐 Secrets

Stored in `.env` (gitignored). See [`.env.example`](.env.example) for the full list.

| Var | Required for | Notes |
|---|---|---|
| `SEMANTIC_SCHOLAR_API_KEY` | Stages 01-04 | Get one free at semanticscholar.org/product/api |
| `OPENROUTER_API_KEY` | Stage 06 (LLM judge) | Free-tier models keep cost at $0 |
| `IEEE_XPLORE_API_KEY` | Stage 01 (optional) | Falls back to manual BibTeX exports |

---

## 📖 License

[MIT](LICENSE) © 2026 Connor Tessaro. Coursework project - private use, no PII.
