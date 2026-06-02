import Link from "next/link";
import { CssAurora } from "@/components/css-aurora";
import { BigStat } from "@/components/big-stat";
import { ClipRevealH2 } from "@/components/clip-reveal-h2";
import { FadeIn } from "@/components/fade-in";
import { CoverageHistogram } from "@/components/coverage-histogram";
import { SLRTable } from "@/components/slr-table";
import { RouteIndex } from "@/components/route-index";
import {
  getCoverageHistogram,
  getOverlap,
  getOverviewStats,
  getRanked,
  getRefsMap,
  getTopCited,
} from "@/lib/data";

export default function HomePage() {
  const stats = getOverviewStats();
  const histo = getCoverageHistogram(10);
  const overlap = getOverlap();
  const top = getTopCited();
  const refsMap = getRefsMap();
  const ranked = getRanked();
  const ranksLookup = Object.fromEntries(
    ranked.map((r) => [r.slr_key, { rank: r.rank, composite: r.composite }]),
  );

  const sortedCov = [...overlap]
    .filter((o) => o.eligible_top_n > 0)
    .sort((a, b) => b.coverage_pct - a.coverage_pct);
  const best = sortedCov[0];
  const worstZero = overlap.filter(
    (o) => o.eligible_top_n > 0 && o.coverage_pct === 0,
  ).length;

  // Most-cited paper in the canonical corpus + how many SLRs in our set
  // actually reference it.
  const mostCitedTop = [...top].sort(
    (a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0),
  )[0];
  const mostCitedRefCount = mostCitedTop
    ? Object.values(refsMap).filter((refs) =>
        refs.some((r) => r.paper_key === mostCitedTop.paper_key),
      ).length
    : 0;
  const mostCitedSlrPct = stats.slrCount
    ? (mostCitedRefCount / stats.slrCount) * 100
    : 0;

  return (
    <>
      {/* HERO */}
      <section className="relative isolate overflow-hidden border-b border-[var(--color-border)]">
        <CssAurora />
        <h1 className="sr-only">
          {stats.slrCount} published SLRs on technical debt graded
          against the {stats.topCount} most-cited papers in the field.
          Average grade: {stats.meanCoveragePct.toFixed(1)}%.
        </h1>
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-4 pb-20 pt-20 sm:px-6 sm:pt-28">
          <div className="col-span-12 flex items-center gap-3">
            <span className="inline-block size-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Average grade · {new Date().getFullYear()}
            </span>
          </div>

          <div className="col-span-12 mt-10 lg:col-span-8">
            <BigStat value={stats.meanCoveragePct / 100} format="pct" />
            <FadeIn delay={0.7}>
              <p
                className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-[var(--color-text-muted)]"
                style={{
                  fontFamily:
                    "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
                }}
              >
                This audit grades {stats.slrCount} published SLRs in the{" "}
                <em>technical debt</em> subfield (shortcuts in code that
                cost time later) against a required-reading list - the{" "}
                {stats.topCount} most-cited papers in the same area on
                Semantic Scholar.{" "}
                <strong className="text-[var(--color-text)]">
                  Average grade: {stats.meanCoveragePct.toFixed(1)}%.
                </strong>{" "}
                Half cite less than{" "}
                {stats.medianCoveragePct.toFixed(1)}% of the list.{" "}
                {worstZero} cite zero of it. Papers published after an SLR
                came out don't count against it - nobody gets blamed for
                missing the future.
              </p>
            </FadeIn>
          </div>

          <div className="col-span-12 mt-2 grid grid-cols-3 gap-3 self-end sm:gap-4 lg:col-span-4 lg:grid-cols-1 lg:gap-6">
            <Meta
              label="Cited none of the list"
              value={worstZero}
              tone="miss"
            />
            <Meta
              label="Median grade"
              value={`${stats.medianCoveragePct.toFixed(1)}%`}
            />
            <Meta
              label="SLRs × required list"
              value={`${stats.slrCount} × ${stats.topCount}`}
            />
          </div>
        </div>
      </section>

      {/* SLR EXPLAINER - quick definition for cold visitors */}
      <section className="border-b border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[14rem_1fr] lg:gap-12">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              What&apos;s an SLR?
            </div>
            <p
              className="max-w-3xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg"
              style={{
                fontFamily:
                  "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
              }}
            >
              <em>Systematic Literature Review.</em> A report that
              summarizes a research field by pulling together a bunch of
              other papers and their findings. SLRs are supposed to be the
              go-to reference for anyone starting work in a field - which
              is exactly why missing citations matters.{" "}
              <Link
                href="/about"
                className="text-[var(--color-accent)] underline-offset-2 hover:underline"
              >
                Why I built this →
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* ROUTE INDEX (lifted above the most-cited callout) */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <RouteIndex />
        </div>
      </section>

      {/* MOST-CITED CALLOUT - editorial break: full-bleed serif */}
      {mostCitedTop && (
        <section
          className="border-y border-[var(--color-border)]"
          style={{ background: "var(--color-accent-soft)" }}
        >
          <div className="mx-auto max-w-5xl px-4 py-24 sm:px-6 sm:py-32">
            <div className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              The paper almost nobody cited
            </div>
            <ClipRevealH2
              className="mt-6 text-balance text-4xl tracking-tight text-[var(--color-text)] sm:text-5xl md:text-6xl lg:text-7xl"
              style={{
                fontFamily:
                  "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
                lineHeight: 1.05,
              }}
            >
              &ldquo;{mostCitedTop.title}&rdquo;
            </ClipRevealH2>
            <p className="mt-8 font-mono text-sm text-[var(--color-text-muted)]">
              {(mostCitedTop.authors ?? []).slice(0, 3).join(", ")}
              {(mostCitedTop.authors?.length ?? 0) > 3 &&
                ` +${(mostCitedTop.authors?.length ?? 0) - 3}`}
              {mostCitedTop.year ? ` · ${mostCitedTop.year}` : ""}
              {mostCitedTop.venue ? ` · ${mostCitedTop.venue}` : ""}
              {mostCitedTop.citationCount
                ? ` · ${mostCitedTop.citationCount.toLocaleString()} cites`
                : ""}
            </p>
            <p
              className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)] sm:text-lg"
              style={{
                fontFamily:
                  "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
              }}
            >
              This is the most-cited paper on the entire required-reading
              list. Cited by {mostCitedRefCount} of {stats.slrCount}{" "}
              published SLRs ({mostCitedSlrPct.toFixed(1)}%). Every other
              paper trails by half - meaning even the strongest signal in
              the field is one most SLRs ignore.
            </p>
            <Link
              href={`/papers/${encodeURIComponent(mostCitedTop.paper_key)}`}
              className="mt-8 inline-flex items-center gap-2 font-mono text-sm text-[var(--color-accent)] hover:underline"
            >
              Who cites it →
            </Link>
          </div>
        </section>
      )}

      {/* DISTRIBUTION */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 lg:col-span-5">
              <h2 className="text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
                Most SLRs fail the assignment.
              </h2>
              <p
                className="mt-5 max-w-md text-base leading-relaxed text-[var(--color-text-muted)]"
                style={{
                  fontFamily:
                    "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
                }}
              >
                Each bar groups SLRs by how much of the{" "}
                {stats.topCount}-paper required-reading list they actually
                cited. The middle SLR lands at{" "}
                <span className="text-[var(--color-text)]">
                  {stats.medianCoveragePct.toFixed(1)}%
                </span>
                . The best SLR reaches{" "}
                <Link
                  href={`/slrs/${encodeURIComponent(best?.slr_id ?? "")}`}
                  className="text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  {best?.coverage_pct.toFixed(1)}%
                </Link>
                .{" "}
                <span className="text-[var(--color-miss)]">{worstZero}</span>{" "}
                cite none of it.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-8">
                <CoverageHistogram bins={histo.bins} counts={histo.counts} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FULL TABLE */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="mb-2 text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
            Every SLR, ranked.
          </h2>
          <p className="mb-8 max-w-2xl text-sm text-[var(--color-text-muted)]">
            All {stats.slrCount} published SLRs. Click any row to see
            exactly which required readings it cited and which it skipped.{" "}
            <em>Grade</em> = % of the {stats.topCount}-paper required-reading
            list this SLR cited (year-controlled).
          </p>
          <SLRTable rows={overlap} ranks={ranksLookup} />
        </div>
      </section>

      {/* OUTRO */}
      <section>
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 lg:col-span-7">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                What this is
              </div>
              <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
                Grading literature reviews on whether they cited the field they claim to review.
              </h2>
              <p
                className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)]"
                style={{
                  fontFamily:
                    "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
                }}
              >
                Coursework project. A six-step Python pipeline pulls every
                paper cited by every published SLR in the technical-debt
                subfield, lines them up against the {stats.topCount}{" "}
                most-cited papers in the same area on Semantic Scholar,
                keeps only papers that came out before each SLR, and
                reports how much overlap there is. Then a five-part ranker
                scores each SLR on coverage, topic fit, citation authority,
                venue diversity, and an AI judge. This site is the UI.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <Link
                href="/method"
                className="group block rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-6 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]/60"
              >
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                  Read the method
                </div>
                <div className="mt-3 font-mono text-base text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                  6 steps · stable join key · year-matched · 5-part rank →
                </div>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function Meta({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: number | string;
  tone?: "default" | "miss";
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-2xl font-medium tabular-nums sm:text-3xl ${
          tone === "miss"
            ? "text-[var(--color-miss)]"
            : "text-[var(--color-text)]"
        }`}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </div>
  );
}
