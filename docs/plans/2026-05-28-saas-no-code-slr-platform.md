# Plan: SaaS no‑code SLR citation audit platform (AWS)

**Date:** 2026-05-28  
**Status:** Draft (handoff to build agent)  
**Based on repo:** `slr-citation-audit` pipeline + overlap explorer (`tools/explorer/`)  

## Goal

Build a hosted, multi-tenant, no‑code platform where users can:

- Create a **Project** for a topic (e.g. “technical debt”, “agile methodologies”).
- Configure search inputs (keywords, year range, sources, top‑N, etc.).
- Run an end‑to‑end pipeline to:
  - find candidate SLRs
  - allow **human validation** of which papers count as SLRs (include/exclude)
  - fetch references, compute overlap, analyze gaps, compute metrics
- Publish a **web dashboard/page** built from the resulting artifacts.
- Invite team members to collaborate on validation and analysis.

Non-goal (v1): fully arbitrary “bring your own SQL / custom code nodes”. The platform should expose safe, typed knobs and keep core matching logic fixed.

## Product shape (user-visible)

### Core workflow (per project)

1. **Project setup**
   - Name, description
   - Topic configuration (keywords, year_min/year_max, top_n, title patterns)
   - Data sources toggles: Semantic Scholar first; ACM/IEEE optional later
   - API keys / credentials management (per org)
2. **Run: Identify candidates**
   - Generate candidate papers from enabled sources
   - Dedupe by paper identity key (DOI → SS id → normalized title; per repo)
3. **Human validation gate (SLR inclusion)**
   - Candidate table UI
   - Team members mark: include/exclude, reason, optional paper type
   - “Approved set” becomes the project’s SLR corpus (versioned)
4. **Run: Metrics & artifacts**
   - Fetch references (SS), Crossref backfill optionally
   - Compute top-cited corpus
   - Compute overlap w/ date controls
   - Gap analysis summaries
   - Render figures
5. **Dashboard / publish**
   - Host an interactive dashboard (based on `tools/explorer/` concept)
   - Share within org; optional public link per run

### “Node-based” UX (no-code)

Start with a guided pipeline that looks like nodes/steps (a wizard with optional branches):

- **Node: Topic config**
- **Node: Identify SLR candidates**
- **Node: Validate SLRs (human gate)**
- **Node: Compute metrics**
- **Node: Publish dashboard**

Later: true canvas editor (React Flow) if users need re-wiring. For v1, fixed DAG is faster and safer.

## Mapping to existing repo pipeline

The repo already has a staged flow and entrypoints:

- Identify: `01_identify_slrs/search_semantic_scholar.py`, `search_acm.py`, `search_ieee.py`
- Classify + manual decisions: `01_identify_slrs/classify_slrs.py` (writes `data/manual/<source>/slr_decisions.csv`)
- References: `02_extract_refs/fetch_references.py`, plus `fetch_references_crossref.py`
- Top-cited: `03_top_cited/fetch_top_cited.py`
- Overlap: `04_overlap/compute_overlap.py` + date control logic
- Gaps: `05_explain_gaps/analyze_gaps.py`
- Dashboard prototype: `tools/explorer/`

Platform job runner should execute these stages (or refactored equivalents), but must become:

- **project-scoped** (paths + config not global repo files)
- **manifest-driven** (inputs/outputs explicit)
- **multi-tenant safe** (org/project isolation enforced)

## Key architecture decisions (v1)

### Tenancy & isolation

- **Default**: shared Postgres for all customers; isolate by `org_id` on every table.
- Optional later: dedicated DB per enterprise org (not v1).

### Storage split

- **Postgres (RDS)**: metadata + decisions + summaries.
- **S3**: large artifacts (raw API cache JSON, processed JSON/CSV, figures, exported dashboard assets).

### Async execution

Pipeline runs are long. Use a queue + workers.

- **SQS** queue for jobs
- **Worker service** (Python) pulls jobs, executes pipeline, writes artifacts to S3, updates DB

### Authentication

Pick one:

- **AWS Cognito** (managed auth): email/password, social logins optional
- Or app-managed auth (NextAuth/Auth.js or similar) if you want faster iteration.

For AWS-first + teams, Cognito is reasonable, but anticipate setup friction.

## Suggested AWS reference architecture

### Services

- **RDS Postgres**: relational DB
- **S3**: artifacts bucket
- **CloudFront**: CDN for dashboard/public assets (optional in v1)
- **ECS Fargate** (recommended) or **App Runner** (simpler) for:
  - API service
  - Worker service
- **SQS**: job queue
- **Secrets Manager**: store third-party API keys (SS key, Crossref email, etc.)
- **CloudWatch**: logs + alarms

### Data layout in S3

Use a deterministic prefix to prevent cross-tenant leakage:

`s3://<bucket>/org/<org_id>/project/<project_id>/run/<run_id>/...`

Suggested artifact paths:

- `raw/ss_search/*.json`
- `raw/refs/<slr_id>.json`
- `processed/slr_candidates.json`
- `processed/slr_corpus.json`
- `processed/slr_references.json`
- `processed/top_cited.json`
- `processed/overlap_matrix.csv`
- `processed/gap_analysis.csv`
- `figures/*.png`
- `publish/*` (static dashboard bundle)

## Data model (minimum viable schema)

All tables include `org_id` (or `tenant_id`) for isolation.

### Users & orgs

- `users`: id, email, name, created_at
- `orgs`: id, name, created_at
- `org_members`: org_id, user_id, role (`owner|admin|editor|viewer`), created_at

### Projects & config

- `projects`: id, org_id, name, description, created_by, created_at
- `project_configs`: id, project_id, version, json_config, created_by, created_at
  - `json_config` mirrors existing `core.config.Config` + source toggles + flags

### Runs & jobs

- `runs`: id, project_id, config_id, status, started_at, finished_at, error_summary
- `run_steps`: id, run_id, step_key, status, started_at, finished_at, log_s3_key

### Candidates & decisions (human validation)

Store minimal bibliographic fields for table rendering; keep full raw payload in S3.

- `papers`: id, ss_paper_id, doi, title, year, venue, external_ids_json (optional)
- `slr_candidates`: id, run_id, paper_id, source, candidate_reason_json
- `slr_decisions`: id, project_id, paper_id, verdict (`include|exclude|unsure`), reason, decided_by, decided_at
  - optional: `paper_type` (`slr|sms|survey|unknown`)

Important: decisions are **per project** (not per run), so new runs can reuse prior decisions; new candidates appear as “unreviewed”.

### Metrics summaries (optional but useful)

- `project_metrics`: project_id, latest_run_id, coverage_stats_json, updated_at

## API surface (v1)

### Auth & org

- `POST /auth/*` (or Cognito flows)
- `GET /me`
- `POST /orgs`
- `POST /orgs/:orgId/invite` (email invite)
- `POST /orgs/:orgId/invite/accept`

### Projects

- `POST /orgs/:orgId/projects`
- `GET /orgs/:orgId/projects`
- `GET /projects/:projectId`
- `POST /projects/:projectId/configs` (create new config version)
- `GET /projects/:projectId/configs`

### Runs

- `POST /projects/:projectId/runs` (body: config_id + flags; enqueue SQS job)
- `GET /projects/:projectId/runs`
- `GET /runs/:runId`
- `GET /runs/:runId/steps`

### Candidates & decisions (validation UI)

- `GET /projects/:projectId/candidates?runId=...&status=unreviewed|included|excluded`
- `POST /projects/:projectId/decisions` (bulk upsert decisions)
- `GET /projects/:projectId/decisions`

### Artifacts & publish

- `GET /runs/:runId/artifacts` (list + presigned URLs)
- `POST /runs/:runId/publish` (build static bundle into `publish/`)
- `GET /publish/:runId/*` (served via CDN or app)

## Worker execution plan (pipeline orchestration)

### Job payload

SQS message:

```json
{
  "org_id": "org_...",
  "project_id": "proj_...",
  "run_id": "run_...",
  "config_id": "cfg_...",
  "steps": {
    "identify": true,
    "fetch_refs": true,
    "crossref_backfill": true,
    "top_cited": true,
    "overlap": true,
    "gaps": true,
    "figures": true,
    "publish": false
  }
}
```

### Deterministic working directory

Each run executes in an isolated local workspace (ephemeral container FS), using:

- download config + prior decisions from DB
- write intermediate files to local disk
- upload artifacts to S3

### Human gate behavior

Two run modes:

1. **Candidate run**: stops after identify/classify and writes candidate list. UI asks for review.
2. **Full run**: requires that at least one SLR is included; uses project decisions to build the SLR corpus.

This matches your repo reality: manual classification is essential and should be first-class.

## Dashboard strategy (publish page)

### Fastest path (v1)

Reuse the `tools/explorer/` concept:

- Make the dashboard load data via URLs (S3 presigned or API endpoints) rather than fixed `/data/processed/...`.
- Publish step writes a static bundle to `publish/` in S3.
- Provide a per-run URL: `/p/<run_id>` (org-authenticated) and optional `/public/<token>` later.

### Views to include

- Overview: per-SLR coverage, histogram, KPIs
- SLR detail: hits/misses, reference list, top-cited misses
- Top-cited detail: cited-by vs missed-by SLRs
- Export: CSV/JSON download for overlap + gaps

## Security & permissions (must-have)

- Every DB query scoped by `org_id` and `project_id`.
- Every S3 key prefixed by `org_id/project_id/run_id`.
- Presigned URLs must be short-lived and only minted after permission checks.
- Roles:
  - **viewer**: read-only metrics/artifacts
  - **editor**: can edit decisions + configs, trigger runs
  - **admin/owner**: manage members, secrets, billing (later)

## Operational concerns

- Rate limits: implement SS client throttling and caching; expose run logs and retry.
- Idempotency: re-running a step should overwrite artifacts at the run prefix (or version them by step attempt).
- Observability: capture per-step logs to S3 and/or CloudWatch, link in UI.
- Cost controls: quotas per org (max concurrent runs, max candidates, max top_n).

## Implementation plan (phased)

### Phase 0 — Product skeleton (1–2 weeks)

- Repo split or monorepo with:
  - `apps/web` (Next.js)
  - `apps/api` (FastAPI or Node API)
  - `apps/worker` (Python)
- Postgres schema + migrations
- Auth + orgs + projects + members
- Project config CRUD (store JSON config)

### Phase 1 — Candidate + validation gate (1–2 weeks)

- Worker runs **identify** step for SS only:
  - produce `slr_candidates.json` artifact
  - ingest summary rows into DB for table display
- UI candidate table with include/exclude + bulk actions
- Persist decisions per project

### Phase 2 — Full pipeline run (1–3 weeks)

- Build SLR corpus from decisions
- Fetch refs (SS), optional Crossref backfill
- Top-cited + overlap + gaps
- Store artifacts in S3 + summaries in DB
- UI metrics pages driven by artifacts

### Phase 3 — Publish dashboard (1–2 weeks)

- Convert explorer to load data via API/S3
- “Publish” action per run
- Shareable org-authenticated link

### Phase 4 — Teams polish + guardrails

- Invite flows, roles enforcement everywhere
- Audit trail on decisions (who/when)
- “New candidates since last review” UX

## Open questions (decide early)

1. Do we store full paper payloads in DB or only minimal fields + S3 pointer?
2. Are decisions immutable across config versions, or do we allow multiple “decision sets” per project?
3. Do we support “unsure” verdict and a review queue?
4. What’s the pricing/quota model (concurrency, max candidates, top_n cap)?
5. Public sharing: yes/no in v1; if yes, tokenized URLs and redaction.

## Acceptance criteria (v1)

- A user can sign up, create an org, invite a teammate.
- Create a project, set keywords/year range, run candidate step.
- Team validates included SLRs in UI (saved per project).
- Run full pipeline and view overlap + gap metrics in browser.
- Download artifacts and/or view a published dashboard page.

