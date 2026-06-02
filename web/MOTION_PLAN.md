# Motion Roadmap

Stack: `motion` v12 (Motion's React API, ex Framer Motion).

## Shipped (already on `main`)

| Module | Where | Type |
|--|--|--|
| KPI count-up | `components/big-stat.tsx` | `animate(useMotionValue, target)`, eased 600ms, respects `useReducedMotion` |
| Table row stagger | `components/slr-table.tsx` | `motion.tr` with `delay: i * 15ms` capped at 400ms |
| Histogram bar grow | `components/coverage-histogram.tsx` | `motion.div` height tween, `delay: i * 50ms` |
| Detail tab content fade | `components/slr-detail.tsx`, `paper-detail.tsx` | `motion.div` per row |
| ⌘K palette spring | `components/command-palette.tsx` | `AnimatePresence` overlay + scale + y |
| Compare panel reveal | `components/compare-picker.tsx` | `motion.div` key on `${aId}-${bId}` |
| Coverage gauge fill | `components/slr-detail.tsx` `CoverageGauge` | width tween |
| Route index stagger | `components/route-index.tsx` (new) | `useInView` + per-item delay |

## Next pass - Route + section motion

Anchor: tighter sense of motion identity. None of the below adds heavy code.

1. **Layout-level page transitions** - wrap `<main>` in `layout.tsx` with a client `<PageTransition>` component using `AnimatePresence` keyed on `usePathname()`. 200ms fade + 4px y. Buys the site a recognizable cadence between routes.
2. **Scroll-driven section reveals on `/`** - wrap each `<section>` body in `motion.div` with `useInView({once: true, margin: "-15%"})`. Hero stays static (above the fold), every other section fades-in once it enters viewport.
3. **Hero subhead fade-in after the BigStat lands** - `motion.p` with `initial={{opacity: 0}}` and `animate={{opacity: 1}}` delayed `1s` (after count-up). Sells the build-up.
4. **Most-cited callout typographic entrance** - `motion.h2` with `clipPath` reveal (`inset(0 100% 0 0)` → `inset(0 0% 0 0)`) on enter. One deliberate cinema moment, fits the editorial break.
5. **SLR table sort-change FLIP** - when sort key changes, animate row reordering via `layout` prop on `motion.tr`. Motion v12 ships free layout animations.

## Polish pass - Microinteractions

6. **Hover lift on cards** - turn the static `transition-colors` into a `motion.div` with `whileHover={{y: -2}}` on KPI tiles, explore cards, route index rows. ~10ms of warmth.
7. **⌘K kbd nudge** - header `⌘K search` button: `whileHover={{scale: 1.04}}`, `whileTap={{scale: 0.97}}`. Tells users it's interactive.
8. **Graph node click feedback** - `/graph` node selection triggers a brief `motion.div` flash on the detail panel border. Connects 3D selection to 2D readout.
9. **Theme-toggle FLIP morph** - when adding light theme, use `motion.div` with `layoutId="theme-pill"` between sun/moon icons.

## Constraints

- Never re-animate the same value on every navigation. `once: true` + `useInView` keeps reveals one-shot per session.
- Respect `useReducedMotion()` in every wrapper. The hook is already imported via `motion/react`; call it at the top of any `"use client"` motion component and use the return as a guard.
- Cap stagger fan-out: `delay: Math.min(i * step, 0.4)`. Tables with 74 rows should not spend 7 seconds animating in.
- No spring overshoot on critical numbers. The headline `7.9%` must be the final value the moment it stops. Use `ease: [0.16, 1, 0.3, 1]` (out-expo), not spring.
- No motion on `/graph` outside Three.js (the 3D library owns the cinema). The 2D selection panel can flash, that's it.

## Out of scope for now

- GSAP. Motion v12 covers every move on the list. GSAP only earns its weight if we go editorial-scroll (Pudding-style) which is a different direction.
- Lenis smooth scroll. Hits the "AI design template" tell. Default browser scroll is fine on a 5-section page.
- View Transitions API. Promising but Next 16 + App Router support is still rough. Revisit when stable.
