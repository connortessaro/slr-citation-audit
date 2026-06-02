# slr-citation-audit — Claude Code Project Config

Project-specific routing for ECC skill surface. Global ECC plugin stays installed (181 skills); this file narrows the DAILY surface for this repo.

## Stack
- Python 3, pytest
- Semantic Scholar API, OpenRouter LLM, sentence-transformers embeddings
- pandas, networkx, pymupdf, dotenv
- 6-stage pipeline: `01_identify_slrs` → `06_rank`
- No web frontend, no DB, no Docker

## DAILY skills (load every session)

Invoke via `Skill` tool when task matches. These are first-choice for this repo:

**Python core**
- `ecc:python-review` — review any `.py` change
- `ecc:python-testing` — pytest, fixtures, parametrization
- `ecc:python-patterns` — Pythonic idioms, type hints
- `ecc:tdd-workflow` — write test first

**Planning + review**
- `ecc:plan` — multi-step pipeline work
- `ecc:code-review` — diff review
- `ecc:security-review` — `.env` keys, API credential handling
- `ecc:architecture-decision-records` — record ranker design choices

**Git/PR**
- `ecc:git-workflow`
- `ecc:prp-commit`, `ecc:prp-pr`, `ecc:prp-plan`

**LLM-pipeline (high fit for this repo)**
- `ecc:cost-aware-llm-pipeline` — OpenRouter spend control
- `ecc:regex-vs-llm-structured-text` — citation parsing decisions
- `ecc:eval-harness` — ranker output evaluation
- `ecc:ai-first-engineering`

**Research / docs**
- `ecc:exa-search` — semantic web search
- `ecc:documentation-lookup` — context7 for `semanticscholar`, `sentence-transformers`, etc.
- `ecc:deep-research` — SLR-domain investigation

**Session / memory**
- `ecc:save-session`, `ecc:resume-session`
- `ecc:continuous-learning-v2`, `ecc:learn-eval`
- `ecc:context-budget`
- `ecc:aside`

## LIBRARY skills

Everything else stays accessible via search/manual invoke but is NOT routing priority for this repo. See `.claude/skills/skill-library/SKILL.md` for grouped index.

Off-stack examples (do not route here):
- All JVM, Rust, Go, C++, C#, Swift, Kotlin, Dart, Perl, PHP stacks
- Web frontends (Next.js, React, Nuxt, frontend-design)
- Mobile (iOS, Android, Compose, SwiftUI)
- Infra (Docker, deployment, Postgres, ClickHouse)
- Domain ops (healthcare, energy, logistics, customs, finance)
- Content/social (X API, content-engine, brand-voice, investor outreach)
- Media gen (fal.ai, manim, remotion, video-editing)

## Project conventions
- Pipeline stages numbered `NN_<purpose>/`; each stage owns its outputs in `data/`
- Config via `.env` (dotenv_values, no global mutation) — see `lib/config.py`
- Semantic Scholar: bulk endpoint, page size <=100, workflow cache
- Tests under `tests/`, run with `pytest`
