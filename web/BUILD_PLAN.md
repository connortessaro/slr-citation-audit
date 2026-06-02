# SLR Audit - Web Redesign Build Plan

Branch: `feat/explorer-redesign` (forked from `features/tonyBranch`)
Target: portfolio-grade rewrite of `tools/explorer/`.

## Locked decisions

| | |
|--|--|
| Direction | A - Linear/Vercel dark-first minimal pro |
| Stack | Next.js 15 App Router + TypeScript |
| Style | Tailwind v4 + shadcn/ui |
| Motion | Framer Motion (Motion's React API) |
| 3D | React Three Fiber + drei (vanilla Three.js core) |
| Shaders | TSL via `webgpu-threejs-tsl` skill (WebGPU renderer w/ WebGL fallback) |
| Charts | Recharts |
| Type | Geist Sans + Geist Mono |
| Palette | `#0a0a0a` bg · `#00ff88` accent · 9-step neutral |
| Deploy | Vercel |
| Data | Static import of `data/processed/ss/*.json` at build time |

## 3D usage

- **Hero aurora shader bg** - full-bleed R3F `<Canvas>` in header. TSL fragment shader (Perlin/simplex drift). Pauses off-viewport, reduced-motion = static gradient.
- **`/graph` route** - citation network (74 SLRs + 60 top papers, edges = ref citations). Hover highlight, click → detail, mobile 2D fallback.

## Motion modules

- KPI count-up on mount (`useMotionValue` + spring)
- Stagger reveal on table rows (delay `i * 30ms`)
- Hover lift + accent glow on cards
- Tab/route swap via View Transitions API
- ⌘K palette spring (`scale 0.95 → 1`)
- Theme toggle FLIP morph
- Chart bar grow on `IntersectionObserver`
- Reduced-motion respected everywhere

## Routes

| Route | Replaces (old) | Purpose |
|--|--|--|
| `/` | Overview tab | KPIs, coverage hist, top-cited chart, sortable SLR table |
| `/slrs` | SLRs tab | Sidebar list → detail (refs, hits, misses, gauge) |
| `/slrs/[id]` | - | Direct deep-link to one SLR |
| `/papers` | Top cited tab | Sidebar → which SLRs cite vs miss |
| `/papers/[id]` | - | Deep-link |
| `/consensus` | SLR consensus tab | Most-cited across all SLR bibliographies |
| `/compare` | Compare SLRs tab | Pairwise reference overlap (Jaccard) |
| `/graph` | new | 3D citation network |
| `/method` | new | Static explainer page (markdown) |

## Phases (sequential, single branch)

| # | Phase | Output |
|--|--|--|
| 0 | Scaffold Next 15 app in `web/`, install deps, init shadcn, copy data files | `web/` boots `pnpm dev` |
| 1 | App shell - root layout, dark theme, header w/ aurora bg, nav, footer, Geist fonts | `/` renders shell |
| 2 | Overview route - KPI tiles w/ count-up, coverage hist, top-cited chart, SLR table | `/` matches old overview |
| 3 | SLR + paper detail routes | `/slrs`, `/slrs/[id]`, `/papers`, `/papers/[id]` |
| 4 | `/graph` - R3F force network | network renders |
| 5 | `/compare` + `/consensus` | parity w/ old explorer |
| 6 | ⌘K palette, theme toggle, View Transitions, a11y pass | Lighthouse ≥ 95 |
| 7 | Playwright E2E (webapp-testing skill), Vercel deploy, README | live preview URL |

## Verification recipe

```
cd web
pnpm dev              # http://localhost:3000
```

Playwright MCP via `webapp-testing` skill:
- Navigate `/`, snapshot, screenshot
- Click ⌘K, type "Tom et al"
- Navigate `/graph`, hover node, snapshot
- Lighthouse via `chrome --lighthouse`

Smoke tests in `web/tests/`:
- Each route renders without console error
- Theme toggle persists in localStorage
- Reduced-motion disables Three.js animation

## Skills routed per phase

| Skill | Used in |
|--|--|
| `ecc:nextjs-turbopack` | scaffold + build patterns |
| `ecc:frontend-design` | visual direction |
| `ecc:frontend-patterns` | React idioms |
| `ecc:documentation-lookup` (context7) | Motion + Three.js + R3F live docs |
| `webgpu-threejs-tsl` | hero aurora TSL shader |
| `ecc:design-system` | tokens, Tailwind config |
| `ecc:typescript-reviewer` (agent) | TS safety per phase |
| `webapp-testing` + Playwright MCP | E2E + screenshots |
| `web-design-guidelines` | a11y/UX audit (phase 6) |
| `ecc:code-review` | diff review per phase |
| `ecc:prp-commit` + `ecc:prp-pr` | commits + PR |

## Out of scope

- Server actions / API routes (data is static)
- Auth, DB, real-time
- Pipeline changes (Python untouched)
- Old `tools/explorer/` deletion - keep until new is shipped, then remove in final phase


