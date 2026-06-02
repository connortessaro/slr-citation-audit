---
name: skill-library
description: Router for ECC LIBRARY skills not loaded by default in slr-citation-audit. Groups off-stack and domain skills by trigger keyword. Invoke when the task genuinely matches a LIBRARY domain — otherwise prefer DAILY skills listed in .claude/CLAUDE.md.
---

# Skill Library Router

slr-citation-audit DAILY surface = 25 skills (see `.claude/CLAUDE.md`). LIBRARY = remaining ECC skills, kept accessible but NOT routed by default.

Use this router only when a request clearly falls into a LIBRARY domain. Otherwise stay in DAILY.

## LLM Engineering (adjacent to DAILY)
Triggers: "agent harness", "eval comparison", "agent payment", "mcp server", "claude api migration", "iterative retrieval"
- `ecc:claude-api`, `ecc:agent-harness-construction`, `ecc:agentic-engineering`
- `ecc:agent-eval`, `ecc:eval-harness` (DAILY)
- `ecc:agent-payment-x402`, `ecc:agent-introspection-debugging`
- `ecc:autonomous-agent-harness`, `ecc:autonomous-loops`, `ecc:continuous-agent-loop`
- `ecc:mcp-server-patterns`, `ecc:iterative-retrieval`

## Data Engineering / Ops (adjacent to DAILY)
Triggers: "Postgres", "ClickHouse", "migration", "scraper", "cache pattern"
- `ecc:postgres-patterns`, `ecc:clickhouse-io`, `ecc:database-migrations`
- `ecc:data-scraper-agent`, `ecc:content-hash-cache-pattern`
- `ecc:dashboard-builder`, `ecc:knowledge-ops`

## Research / Knowledge
Triggers: "market research", "investor research", "lead intel", "competitive"
- `ecc:market-research`, `ecc:lead-intelligence`, `ecc:investor-outreach`, `ecc:investor-materials`

## Web Frontend (off-stack)
Triggers: "React", "Next.js", "Nuxt", "Tailwind", "frontend slides", "UI demo"
- `ecc:frontend-patterns`, `ecc:frontend-design`, `ecc:design-system`
- `ecc:nextjs-turbopack`, `ecc:nuxt4-patterns`
- `ecc:frontend-slides`, `ecc:ui-demo`, `ecc:browser-qa`
- `ecc:design-taste-frontend`, `ecc:web-design-guidelines`

## JVM stack (off-stack)
Triggers: "Java", "Spring Boot", "Kotlin", "JPA"
- `ecc:java-coding-standards`, `ecc:springboot-patterns`, `ecc:springboot-security`, `ecc:springboot-tdd`, `ecc:springboot-verification`
- `ecc:kotlin-patterns`, `ecc:kotlin-coroutines-flows`, `ecc:kotlin-ktor-patterns`, `ecc:kotlin-exposed-patterns`, `ecc:kotlin-review`, `ecc:kotlin-build`, `ecc:kotlin-test`, `ecc:kotlin-testing`
- `ecc:jpa-patterns`

## Other languages (off-stack)
- Go: `ecc:golang-patterns`, `ecc:golang-testing`, `ecc:go-review`, `ecc:go-build`, `ecc:go-test`
- Rust: `ecc:rust-patterns`, `ecc:rust-review`, `ecc:rust-build`, `ecc:rust-test`, `ecc:rust-testing`
- C++: `ecc:cpp-coding-standards`, `ecc:cpp-review`, `ecc:cpp-build`, `ecc:cpp-test`, `ecc:cpp-testing`
- C#/.NET: `ecc:dotnet-patterns`, `ecc:csharp-testing`
- Swift: `ecc:swift-actor-persistence`, `ecc:swift-concurrency-6-2`, `ecc:swift-protocol-di-testing`, `ecc:swiftui-patterns`, `ecc:liquid-glass-design`, `ecc:foundation-models-on-device`
- Mobile cross-plat: `ecc:dart-flutter-patterns`, `ecc:flutter-review`, `ecc:flutter-build`, `ecc:flutter-test`, `ecc:android-clean-architecture`, `ecc:compose-multiplatform-patterns`
- PHP: `ecc:laravel-patterns`, `ecc:laravel-security`, `ecc:laravel-tdd`, `ecc:laravel-verification`, `ecc:laravel-plugin-discovery`
- Perl: `ecc:perl-patterns`, `ecc:perl-security`, `ecc:perl-testing`
- Python web: `ecc:django-patterns`, `ecc:django-security`, `ecc:django-tdd`, `ecc:django-verification`, `ecc:nestjs-patterns`

## Infra / Deploy (off-stack)
- `ecc:docker-patterns`, `ecc:deployment-patterns`, `ecc:bun-runtime`, `ecc:nodejs-keccak256`
- `ecc:api-design`, `ecc:api-connector-builder`, `ecc:backend-patterns`
- `ecc:hexagonal-architecture`

## Domain ops (off-stack)
- Healthcare: `ecc:healthcare-cdss-patterns`, `ecc:healthcare-emr-patterns`, `ecc:healthcare-phi-compliance`, `ecc:hipaa-compliance`, `ecc:healthcare-eval-harness`
- Trade/logistics: `ecc:customs-trade-compliance`, `ecc:carrier-relationship-management`, `ecc:logistics-exception-management`, `ecc:returns-reverse-logistics`, `ecc:visa-doc-translate`
- Manufacturing: `ecc:production-scheduling`, `ecc:inventory-demand-planning`, `ecc:quality-nonconformance`
- Energy: `ecc:energy-procurement`
- Finance: `ecc:finance-billing-ops`, `ecc:customer-billing-ops`
- Crypto: `ecc:defi-amm-security`, `ecc:evm-token-decimals`, `ecc:llm-trading-agent-security`

## Content / Social (off-stack)
- `ecc:content-engine`, `ecc:brand-voice`, `ecc:article-writing`, `ecc:seo`
- `ecc:x-api`, `ecc:crosspost`, `ecc:connections-optimizer`, `ecc:social-graph-ranker`
- `ecc:google-workspace-ops`, `ecc:email-ops`, `ecc:messages-ops`, `ecc:unified-notifications-ops`

## Media (off-stack)
- `ecc:fal-ai-media`, `ecc:remotion-video-creation`, `ecc:manim-video`, `ecc:video-editing`, `ecc:nutrient-document-processing`, `ecc:videodb`

## Security (specialized, on-demand)
- `ecc:security-review` (DAILY), `ecc:security-bounty-hunter`, `ecc:security-scan`, `ecc:repo-scan`
- `zeroize-audit`, `constant-time-analysis`, `insecure-defaults`, `differential-review`
- `semgrep`, `codeql`, `sarif-parsing`, `variant-analysis`
- `supply-chain-risk-auditor`, `audit-prep-assistant`

## ML / Training (off-stack for current pipeline)
- `ecc:pytorch-patterns`, `ecc:ai-regression-testing`

## Misc workflow (use when explicitly needed)
- `ecc:orchestrate`, `ecc:dmux-workflows`, `ecc:claude-devfleet`, `ecc:team-builder`
- `ecc:gan-style-harness`, `ecc:santa-method`, `ecc:santa-loop`, `ecc:ralphinho-rfc-pipeline`
- `ecc:hookify`, `ecc:hookify-rules`, `ecc:hookify-configure`
- `ecc:rules-distill`, `ecc:strategic-compact`, `ecc:skill-stocktake`, `ecc:agent-sort`, `ecc:configure-ecc`
- `ecc:product-lens`, `ecc:product-capability`, `ecc:blueprint`, `ecc:ai-first-engineering` (DAILY)
- `ecc:codebase-onboarding`, `ecc:code-tour`, `ecc:click-path-audit`
- `ecc:openclaw-persona-forge`, `ecc:nanoclaw-repl`, `ecc:enterprise-agent-ops`, `ecc:canary-watch`
- `ecc:ecc-tools-cost-audit`, `ecc:automation-audit-ops`, `ecc:project-flow-ops`
- `ecc:token-budget-advisor`, `ecc:context-budget` (DAILY)
- `ecc:benchmark`, `ecc:performance-optimizer`
- `ecc:e2e-testing`, `ecc:webapp-testing`

## How to use this router
1. Check DAILY list in `.claude/CLAUDE.md` first
2. If no DAILY match, scan groups above by trigger keyword
3. If still no match, the task likely doesn't need an ECC skill — proceed with general tools
