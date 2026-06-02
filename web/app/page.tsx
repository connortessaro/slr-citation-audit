import { AuroraBg } from "@/components/aurora-bg";
import { KpiTile } from "@/components/kpi-tile";
import { CoverageHistogram } from "@/components/coverage-histogram";
import { SLRTable } from "@/components/slr-table";
import {
  getOverviewStats,
  getCoverageHistogram,
  getOverlap,
} from "@/lib/data";

export default function HomePage() {
  const stats = getOverviewStats();
  const histo = getCoverageHistogram(10);
  const overlap = getOverlap();

  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[var(--color-border)]">
        <AuroraBg />
        <div className="bg-grid absolute inset-0 -z-10 opacity-40" aria-hidden />
        <div className="mx-auto flex max-w-7xl flex-col gap-10 px-6 py-24 sm:py-32">
          <div className="max-w-3xl">
            <p className="mb-4 inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-accent)]">
              <span className="size-1 rounded-full bg-[var(--color-accent)]" />
              Citation coverage audit
            </p>
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.02em] text-[var(--color-text)] sm:text-5xl">
              How well do SLRs in technical debt cite the field&apos;s most
              influential work?
            </h1>
            <p className="mt-5 max-w-2xl text-pretty text-base text-[var(--color-text-muted)] sm:text-lg">
              Date-controlled overlap analysis of{" "}
              <span className="text-[var(--color-text)]">{stats.slrCount}</span>{" "}
              systematic literature reviews against the{" "}
              <span className="text-[var(--color-text)]">{stats.topCount}</span>{" "}
              most-cited papers in the technical-debt subfield on Semantic
              Scholar.
            </p>
          </div>

          {/* KPI grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <KpiTile label="SLRs" value={stats.slrCount} delay={0.0} />
            <KpiTile label="Top corpus" value={stats.topCount} delay={0.06} />
            <KpiTile
              label="With refs"
              value={stats.slrsWithRefs}
              delay={0.12}
            />
            <KpiTile
              label="Mean cov"
              value={stats.meanCoveragePct / 100}
              format="pct"
              highlight
              delay={0.18}
            />
            <KpiTile
              label="Median cov"
              value={stats.medianCoveragePct / 100}
              format="pct"
              delay={0.24}
            />
            <KpiTile label="Zero cov" value={stats.zeroCoverage} delay={0.3} />
          </div>
        </div>
      </section>

      {/* Coverage histogram */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
              Coverage distribution
            </h2>
            <p className="mt-4 max-w-md text-sm text-[var(--color-text-muted)]">
              How many SLRs land in each coverage bucket against the
              date-controlled top-50 corpus. The bulk sit below 25% — most SLRs
              miss the canonical influential papers in their own subfield.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs">
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                  Median
                </div>
                <div className="mt-1 font-mono text-xl tabular-nums text-[var(--color-text)]">
                  {stats.medianCoveragePct.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                  Top quartile
                </div>
                <div className="mt-1 font-mono text-xl tabular-nums text-[var(--color-accent)]">
                  {(() => {
                    const covs = overlap
                      .filter((o) => o.eligible_top_n > 0)
                      .map((o) => o.coverage_pct)
                      .sort((a, b) => a - b);
                    if (covs.length === 0) return "—";
                    const q3 = covs[Math.floor(covs.length * 0.75)];
                    return `${q3.toFixed(1)}%`;
                  })()}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-8">
            <CoverageHistogram bins={histo.bins} counts={histo.counts} />
          </div>
        </div>
      </section>

      {/* SLR table */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <SLRTable rows={overlap} />
      </section>

      {/* Quick links */}
      <section className="mx-auto max-w-7xl px-6 pb-24">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          Explore
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              href: "/slrs",
              title: "SLRs",
              desc: "Browse each review — references, hits, misses, coverage gauge.",
            },
            {
              href: "/papers",
              title: "Top cited",
              desc: "Which SLRs cite each paper of the canonical top-50.",
            },
            {
              href: "/consensus",
              title: "Consensus",
              desc: "Papers most cited across SLR bibliographies.",
            },
            {
              href: "/compare",
              title: "Compare",
              desc: "Pairwise reference overlap and Jaccard similarity.",
            },
            {
              href: "/graph",
              title: "Graph",
              desc: "3D citation network — hover, click, orbit.",
            },
            {
              href: "/method",
              title: "Method",
              desc: "Pipeline, date control, paper_key dedup logic.",
            },
          ].map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="group rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]/60"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-sm font-medium text-[var(--color-text)]">
                  {card.title}
                </h3>
                <span className="text-[var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]">
                  →
                </span>
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                {card.desc}
              </p>
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
