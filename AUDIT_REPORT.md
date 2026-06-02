# slr.audit — Portfolio Site Audit

Reading this as: a dev portfolio piece dressed as a research artifact, for an audience of recruiters + professors who scan in seconds. Stack is solid (dark Linear-take, Geist + Iowan serif, restrained accent). The work is real (7.9% mean coverage, 2.0% median, 36 of 74 SLRs at zero — those are sharp numbers). The issues are all surface-level slop hiding the substance.

Owner-quoted complaint "looks generic / templated" is fair, but not because the design is bad. It is because the page has SIX uppercase mono eyebrows above SIX section headers, three competing aurora colors, a banned scroll cue, and three em-dashes in the hero. Those are the specific moments where the page reads as AI-default rather than authored.

The headline number (7.9%) is doing the work it should. The framing copy around it is not.

---

## 1. Writing / Copy

The voice is doing two contradictory things: half "neutral research abstract" (`Date-controlled overlap analysis of...`), half "engineer being precise" (`paper_key dedup (DOI → SS id → title)`). The engineer-voice is better. Lean fully into it. Cut everything that reads like it would appear in a journal abstract.

### Top 5

1. **`web/app/layout.tsx:22-23` — Replace the abstract-voice metadata description.**
   The string `Date-controlled overlap analysis of Systematic Literature Reviews against the top-cited corpus in technical debt research.` is the exact AI-tell the user named. It is the OG card, the browser tab, and the SEO snippet. Replace with:
   ```ts
   description:
     "74 technical-debt literature reviews cite, on average, 7.9% of the most-cited papers in the field they review. Audit + data.",
   ```
   Why: leads with the finding, not the method. Concrete number > academic noun-pile. Reads as engineer-with-receipts, not paper-abstract.

2. **`web/app/page.tsx:56-60` — Cut the em-dashes and the hedge from the hero subhead.**
   Current:
   ```tsx
   The Systematic Literature Reviews that define the technical-debt subfield cite, on average, fewer than one in ten of its most influential papers — even within their own publication horizon.
   ```
   The em-dash is banned, "Systematic Literature Reviews that define the subfield" is wasted nouns, and "fewer than one in ten" obscures the number already shown 96px tall above it. Replace with:
   ```tsx
   74 published reviews, 50 canonical papers, year-matched. Half the field cites less than 2% of it. 36 cite zero.
   ```
   Why: three concrete numbers, three short clauses, names the median and the long tail. Reads as someone who actually ran the pipeline.

3. **`web/app/page.tsx:96-99` — Kill the moralizing eyebrow.**
   `The paper everyone should cite` is preachy and untrue (it is just the most-cited paper, not a normative claim). Replace eyebrow + headline pattern with:
   ```tsx
   <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
     Most cited in the corpus
   </div>
   <h2 ...>{mostCitedTop.title}</h2>
   ```
   Then under the paper, add one sentence of authored interpretation:
   ```
   Cited by {hitCount} of {stats.slrCount} reviews ({pct}%). The strongest signal in the dataset; everything else trails by half.
   ```
   Why: removes the rhetorical lecture; adds an engineer's read on the number.

4. **`web/app/slrs/page.tsx` + `web/app/papers/page.tsx` — Replace the dead "Pick a review" empty states.**
   Both are 19-line "Pick a [thing]" stubs. A recruiter clicking `SLRs` in the top nav lands on an almost-blank centered card. This is a CRO bleeder (see Section 2) and a copy issue. Replace `/slrs/page.tsx`'s body with a sentence + the top-3 best-covered and worst-covered SLRs as direct links:
   ```tsx
   <p>Best coverage in the corpus: {best.title} at {best.coverage}%. Worst (excluding zeros): {worst.title}. <Link href="/...">Open the full ranked table →</Link></p>
   ```
   Same shape for `/papers`: lead with the top-cited paper, link inline.
   Why: every page should answer a question, not ask one.

5. **`web/app/method/page.tsx:32-41, 43-49, 58-66, 67-73, 75-84` — Em-dash sweep + tighten Section 04.**
   Method has six visible em-dashes (lines 33, 38, 44, 58, 62, 67, 75-76 area). All banned. Most punchily:
   - L33: `Three sources — Semantic Scholar bulk search, ACM Digital Library BibTeX exports, and IEEE Xplore — are queried for...` → `Three sources (Semantic Scholar bulk, ACM BibTeX, IEEE Xplore) query for...`
   - L58-65 (Section 04): The whole paragraph spends 60 words on "we don't count misses from the future." Compress to: `For each (SLR, top-paper) pair, the top paper is eligible only if its year ≤ the SLR's. Counting a paper an SLR couldn't have read isn't a miss — it's a calendar. The denominator drops to eligible_top_n.`
   Why: the method page is your "actually a sharp engineer" page; it should read like commits, not a thesis.

---

## 2. CRO / Conversion Path

The 30-second test goes like this: hero loads, recruiter sees `7.9%` at 18vw type, reads one subhead sentence, glances at the nav strip, scrolls once, sees the histogram, decides. The 7.9% is doing its job. Everything around it leaks attention.

### Top 5

1. **`web/app/page.tsx:70-86` — Kill the in-hero nav strip. It competes with the top nav, hides the histogram below the fold, and the scroll cue is a banned AI tell.**
   The strip duplicates the site header (which already has the same links) and adds `↓ scroll · or press ⌘K to search`. A recruiter does not need to be told what scroll is. Delete the entire `<div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 ...">` block (lines 70-86). The header above + the histogram below are enough. This pulls the histogram up ~80px, which is the second-strongest beat on the page.
   Why: highest-impact CRO fix on the home page. Removes a competing UI element AND a banned pattern AND lifts the second money-shot above-the-fold for taller viewports.

2. **`web/app/page.tsx:44-67` — Reorder hero meta. Lead with "36 at 0%" as the secondary number, not "SLRs analyzed".**
   The right rail (`SLRs analyzed | Canonical corpus | SLRs at 0% coverage`) reads in the wrong order. `SLRs analyzed = 74` is a denominator, not a finding. `36 SLRs at 0%` is the second-most striking number in the dataset. Reorder:
   ```tsx
   <Meta label="SLRs at 0% coverage" value={worstZero} tone="miss" />
   <Meta label="Median coverage" value={stats.medianCoveragePct} />  // 2.0%
   <Meta label="Corpus size" value={`${stats.slrCount}/${stats.topCount}`} />  // 74/50
   ```
   Why: the recruiter's eye lands top-right after the big stat. Put the shocking number there. `2.0%` median is also currently buried in body prose on line 150 — surface it.

3. **`/slrs` and `/papers` index pages are CRO black holes.** (Same files as Writing #4.)
   Two of seven top-nav links lead to dead end pages. A recruiter clicks `SLRs` (the most natural next click after "I see a coverage stat, show me which SLRs are bad"), and gets a card saying "pick one." There is no sidebar/list rendered. Add a default list view: render the SLRTable component (already built, in use on `/`) at `/slrs` so the page is immediately useful, or `redirect()` to `/` if you don't want a duplicate.
   Why: every top-nav click should resolve to information. Dead routes are the highest-friction CRO leak on the site.

4. **`web/app/page.tsx:188-245` — The "What this is" + route list is buried at the bottom and is the page's actual portfolio pitch.** Move the right column (the `/slrs · /papers · /consensus · /compare · /graph` list with descriptions) UP, immediately under the hero, before the most-cited callout. That list is the strongest "this person built a real thing" signal — show it within the first scroll.
   Implementation: extract the `<ol>` (lines 215-241) into a `RouteIndex` component and render it after the hero `<section>` closes (line 87), before the most-cited section. Drop the section's `border-b` to keep it visually attached to the hero.
   Why: recruiter scrolls once, sees five concrete routes with one-line descriptions, decides which one to open. Currently they need to scroll past 3 long sections to discover the site has depth.

5. **`web/components/big-stat.tsx:43` — The hero stat animates from 0 to 7.9 over 1.4s. On a 30-second budget, that's 5% spent on a number-tick.** Either drop `duration` to `0.6`, or honor `useReducedMotion` and skip the count-up entirely. Currently a recruiter who scrolls fast sees `0.0%` for almost a second. Replace:
   ```tsx
   duration = 0.6,  // was 1.4
   ```
   And wrap the animate call so reduced-motion users see the final value immediately (the global reduced-motion CSS doesn't reach motion-library values).
   Why: the only number that matters is paid in latency on first paint. Fix it.

---

## 3. Design / Visual

The page has a coherent dark-Linear language. The issues are specific moments where the language is over-applied, not the language itself. Where it feels templated: 6 mono eyebrows in a row, 3-color aurora, neon green + grain on every section, no editorial moment.

### Top 5

1. **`web/app/page.tsx` — Eyebrow count violation (6 instances, cap is 2 for a 6-section page).** Per design-taste-frontend, max 1 eyebrow per 3 sections. Home page sections + their eyebrows:
   - Hero: `Citation coverage audit · 2025` + `Mean coverage of the canonical top-50` (TWO eyebrows in ONE section)
   - Most-cited: `The paper everyone should cite`
   - Distribution: `Coverage distribution`
   - Table: `Every review, ranked`
   - Outro: `What this is`
   **Total = 6. Cap = ceil(6/3) = 2.** Keep `Citation coverage audit · 2025` (it dates the work) and `What this is` (it labels the outro). Delete the other four. Section context (position + headline) carries the meaning. The page will read 30% less templated immediately.

2. **`web/components/css-aurora.tsx` — Three-color aurora violates Color Consistency Lock.** Green (`rgba(0,255,136)`) + teal (`rgba(20,184,166)`) + blue (`rgba(59,130,246)`) = three accents. The site has ONE accent (`--color-accent: #00ff88`). Drop the teal and blue blobs entirely. Replace with:
   ```tsx
   // single green blob, top-left, plus a cool desaturated charcoal blob for depth
   <div className="absolute -left-32 -top-40 h-[600px] w-[600px] rounded-full opacity-80"
        style={{background: "radial-gradient(closest-side, rgba(0,255,136,0.30), transparent 70%)", filter: "blur(80px)"}} />
   <div className="absolute right-[10%] top-[20%] h-[420px] w-[420px] rounded-full opacity-50"
        style={{background: "radial-gradient(closest-side, rgba(255,255,255,0.05), transparent 70%)", filter: "blur(60px)"}} />
   ```
   Why: kills the "templated dark tech with rainbow aurora" tell. Lets the green accent stay distinctive instead of competing with two other hues.

3. **No editorial moment. The whole page is the same rhythm.** Every section is `12-col grid · py-20 · mono eyebrow · sans headline · serif body · component on the right`. That cadence is exactly what reads templated. Pick ONE section to break form. Recommendation: the most-cited paper callout (`page.tsx:90-127`). Make it a full-bleed dark-green panel with the paper title set 6xl in serif, no border-b, no `max-w-7xl` clamp.
   ```tsx
   <section className="bg-[var(--color-accent-soft)] border-y border-[var(--color-border)]">
     <div className="mx-auto max-w-5xl px-6 py-32">
       <h2 className="text-5xl md:text-7xl tracking-tight"
           style={{fontFamily: "'Iowan Old Style', Palatino, Georgia, serif", lineHeight: 1.05}}>
         "{mostCitedTop.title}"
       </h2>
       <p className="mt-8 font-mono text-sm text-[var(--color-text-muted)]">
         {authors} · {year} · cited {citationCount.toLocaleString()} times
       </p>
     </div>
   </section>
   ```
   Why: the page needs one moment where the design says "I made a deliberate choice here." Currently every section says "I followed the grid." This is the cheapest deliberate break to ship.

4. **`web/app/method/page.tsx:178-180` — The big mono accent numbers (`01 02 03 04 05 06`) are the page's best typography moment, and the home page has zero of them.** They appear nowhere on `/`. Borrow the pattern: use a single oversized mono `74` or `7.9` in `var(--color-accent)` somewhere in the histogram section as a sub-display character. Or, in the outro route list (`page.tsx:215-241`), prefix each route with a mono `01 02 03 04 05` in accent — turns a plain `<ol>` into a designed list. Concretely, replace the route list's `<li>` content with:
   ```tsx
   <li className="group flex items-baseline gap-6 border-b border-[var(--color-border)] pb-3">
     <span className="font-mono tabular-nums text-2xl text-[var(--color-accent)] w-10">
       {String(i+1).padStart(2,'0')}
     </span>
     <Link ...>{x.n}</Link>
     <span ...>{x.t}</span>
   </li>
   ```
   Why: ties home page's typography to the method page's signature move. Free distinctiveness from existing brand vocabulary.

5. **`web/components/site-footer.tsx` — Footer is two rows of muted mono text. Generic.** Currently: `Data · data/processed/ss/ · Match paper_key (DOI → SS id → title)` on the left, `Semantic Scholar · tech-debt corpus` on the right. Reads like a CI build footer. Replace with one editorial line that lands:
   ```tsx
   <div className="font-mono text-[11px] text-[var(--color-text-subtle)]">
     74 SLRs · 50 canonical papers · paper_key (DOI → SS id → title) · static build, no runtime
   </div>
   <div className="flex items-center gap-3">
     <a href="https://github.com/...">github</a>
     <span className="text-[var(--color-text-faint)]">·</span>
     <Link href="/method">method</Link>
   </div>
   ```
   Why: footer is the last impression. Make it say one specific thing (the numbers + the architecture choice) instead of being chrome.

---

## Quick Wins (under 10 minutes each)

1. **Em-dash sweep across the codebase.** `grep -rn "—" /Users/tessaro/slr-citation-audit/web/app /Users/tessaro/slr-citation-audit/web/components`, replace each with comma, period, or parens per context. The em-dash is the single most-tested AI tell; zero on the page is the rule. Hot spots: `app/page.tsx:58`, `app/method/page.tsx:33/44/58-62/67/75-77`, `components/slr-detail.tsx`, `components/slr-table.tsx`. ~6 minutes.

2. **Metadata + hero subhead rewrite.** Two strings, copy-paste from Writing #1 and #2. Replace `layout.tsx:22-23` description and `page.tsx:56-60` hero paragraph. ~3 minutes. This alone fixes the "AI tone" complaint on the OG card, the browser tab, and the most-quoted on-site sentence.

3. **Drop the in-hero nav strip.** Delete `page.tsx:70-86`. Removes a banned scroll cue (`↓ scroll`), kills the duplicate nav, lifts the histogram ~80px. ~2 minutes. Highest CRO impact per second spent on the site.

---

## What NOT to change

- The 7.9% display itself. Type scale, mono, count-up animation length aside — it lands.
- The Iowan Old Style serif body in long-form sections. It is the page's most distinctive type move, do not lose it.
- The green accent. Lock it harder (per Design #2), don't replace it.
- The method page's `01 02 03 ... 06` pattern. Spread it; don't dilute it.
- The `paper_key` footnote in the footer. Keep it as the engineering signature.
