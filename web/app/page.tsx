import Link from "next/link";
import { CssAurora } from "@/components/css-aurora";
import { BigStat } from "@/components/big-stat";
import { CoverageHistogram } from "@/components/coverage-histogram";
import { SLRTable } from "@/components/slr-table";
import {
  getCoverageHistogram,
  getOverlap,
  getOverviewStats,
  getTopCited,
} from "@/lib/data";

export default function HomePage() {
  const stats = getOverviewStats();
  const histo = getCoverageHistogram(10);
  const overlap = getOverlap();
  const top = getTopCited();

  const sortedCov = [...overlap]
    .filter((o) => o.eligible_top_n > 0)
    .sort((a, b) => b.coverage_pct - a.coverage_pct);
  const best = sortedCov[0];
  const worstZero = overlap.filter(
    (o) => o.eligible_top_n > 0 && o.coverage_pct === 0,
  ).length;

  const mostCitedTop = [...top].sort(
    (a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0),
  )[0];

  return (
    <>
      {/* HERO — editorial, single huge stat, asymmetric */}
      <section className="relative isolate overflow-hidden border-b border-[var(--color-border)]">
        <CssAurora />
        <div className="mx-auto grid max-w-7xl grid-cols-12 gap-6 px-6 pb-24 pt-20 sm:pt-32">
          <div className="col-span-12 flex items-center gap-3">
            <span className="inline-block size-1.5 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]" />
            <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
              Citation coverage audit · {new Date().getFullYear()}
            </span>
          </div>

          <div className="col-span-12 mt-12 lg:col-span-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
              Mean coverage of the canonical top-{stats.topCount}
            </div>
            <BigStat value={stats.meanCoveragePct / 100} format="pct" />
            <p
              className="mt-8 max-w-xl text-pretty text-lg leading-relaxed text-[var(--color-text-muted)]"
              style={{
                fontFamily:
                  "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
              }}
            >
              The Systematic Literature Reviews that define the
              technical-debt subfield cite, on average, fewer than one in ten
              of its most influential papers — even within their own
              publication horizon.
            </p>
          </div>

          <div className="col-span-12 mt-2 grid grid-cols-3 gap-4 self-end lg:col-span-4 lg:grid-cols-1 lg:gap-6">
            <Meta label="SLRs analyzed" value={stats.slrCount} />
            <Meta label="Canonical corpus" value={stats.topCount} />
            <Meta label="SLRs at 0% coverage" value={worstZero} tone="miss" />
          </div>
        </div>

        <div className="border-t border-[var(--color-border)] bg-[var(--color-bg)]/60 backdrop-blur-sm">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-6 py-4 font-mono text-[11px] text-[var(--color-text-subtle)]">
            <span className="hidden sm:inline">
              ↓ scroll · or press{" "}
              <kbd className="rounded border border-[var(--color-border-strong)] px-1 py-0.5">⌘K</kbd>{" "}
              to search
            </span>
            <span className="flex flex-wrap items-center gap-4">
              <NavLink href="/slrs" label="SLRs" />
              <NavLink href="/papers" label="Top cited" />
              <NavLink href="/consensus" label="Consensus" />
              <NavLink href="/compare" label="Compare" />
              <NavLink href="/graph" label="Graph" accent />
              <NavLink href="/method" label="Method" />
            </span>
          </div>
        </div>
      </section>

      {/* MOST-CITED CALLOUT */}
      {mostCitedTop && (
        <section className="border-b border-[var(--color-border)]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="grid grid-cols-12 gap-6">
              <div className="col-span-12 lg:col-span-4">
                <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                  The paper everyone should cite
                </div>
                <h2 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
                  {mostCitedTop.title}
                </h2>
                <p className="mt-4 font-mono text-xs text-[var(--color-text-muted)]">
                  {(mostCitedTop.authors ?? []).slice(0, 3).join(", ")}
                  {(mostCitedTop.authors?.length ?? 0) > 3 &&
                    ` +${(mostCitedTop.authors?.length ?? 0) - 3}`}
                  {mostCitedTop.year ? ` · ${mostCitedTop.year}` : ""}
                  {mostCitedTop.venue ? ` · ${mostCitedTop.venue}` : ""}
                </p>
                <Link
                  href={`/papers/${encodeURIComponent(mostCitedTop.paper_key)}`}
                  className="mt-6 inline-flex items-center gap-2 font-mono text-xs text-[var(--color-accent)] hover:underline"
                >
                  Who cites it →
                </Link>
              </div>
              <div className="col-span-12 grid grid-cols-2 gap-6 lg:col-span-8 lg:grid-cols-3 lg:gap-10">
                <Inline
                  label="Cites on Semantic Scholar"
                  value={(mostCitedTop.citationCount ?? 0).toLocaleString()}
                  highlight
                />
                <Inline label="Rank in corpus" value={`#${mostCitedTop.rank}`} />
                <Inline label="Published" value={mostCitedTop.year?.toString() ?? "—"} />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* DISTRIBUTION */}
      <section className="border-b border-[var(--color-border)]">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 lg:col-span-5">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                Coverage distribution
              </div>
              <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
                Most reviews miss most of the field.
              </h2>
              <p
                className="mt-5 max-w-md text-base leading-relaxed text-[var(--color-text-muted)]"
                style={{
                  fontFamily:
                    "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
                }}
              >
                Each bar is a slice of SLRs binned by how much of the
                date-controlled canonical corpus they cite. Median sits at{" "}
                <span className="text-[var(--color-text)]">
                  {stats.medianCoveragePct.toFixed(1)}%
                </span>
                . The best review reaches{" "}
                <Link
                  href={`/slrs/${encodeURIComponent(best?.slr_id ?? "")}`}
                  className="text-[var(--color-accent)] underline-offset-2 hover:underline"
                >
                  {best?.coverage_pct.toFixed(1)}%
                </Link>
                ; <span className="text-[var(--color-miss)]">{worstZero}</span>{" "}
                land at zero.
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
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mb-8">
            <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
              Every review, ranked
            </div>
            <h2 className="mt-3 text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
              All {stats.slrCount} SLRs
            </h2>
          </div>
          <SLRTable rows={overlap} />
        </div>
      </section>

      {/* OUTRO */}
      <section>
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="grid grid-cols-12 gap-10">
            <div className="col-span-12 lg:col-span-7">
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
                What this is
              </div>
              <h2 className="mt-3 max-w-2xl text-balance text-3xl font-semibold leading-tight tracking-tight text-[var(--color-text)] sm:text-4xl">
                A coursework audit of how SLRs cite the field they review.
              </h2>
              <p
                className="mt-5 max-w-2xl text-base leading-relaxed text-[var(--color-text-muted)]"
                style={{
                  fontFamily:
                    "'Iowan Old Style', 'Iowan', 'Palatino', Georgia, serif",
                }}
              >
                A 6-stage Python pipeline pulls every paper cited by every
                published SLR in the technical-debt subfield, joins it
                against the Semantic Scholar top-{stats.topCount} for the
                same area, filters by publication year, and reports coverage.
                Built with <code className="font-mono text-[var(--color-text)]">paper_key</code>{" "}
                dedup (DOI → SS id → title), rate-limited bulk API access,
                and a 5-dimension ranker. The UI is this site.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-5">
              <ol className="space-y-3 font-mono text-sm">
                {[
                  { n: "/slrs", t: "Per-review coverage gauge + ref lists" },
                  { n: "/papers", t: "Per-paper SLR recall + miss list" },
                  { n: "/consensus", t: "Most-cited paper across SLRs" },
                  { n: "/compare", t: "Pairwise reference overlap (Jaccard)" },
                  { n: "/graph", t: "Citation network in 3D" },
                ].map((x) => (
                  <li
                    key={x.n}
                    className="group flex items-baseline gap-4 border-b border-[var(--color-border)] pb-3"
                  >
                    <Link
                      href={x.n}
                      className="text-[var(--color-accent)] transition-colors group-hover:text-[var(--color-text)]"
                    >
                      {x.n}
                    </Link>
                    <span className="flex-1 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text)]">
                      {x.t}
                    </span>
                    <span className="text-[var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]">
                      →
                    </span>
                  </li>
                ))}
              </ol>
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
  value: number;
  tone?: "default" | "miss";
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-3xl font-medium tabular-nums ${
          tone === "miss"
            ? "text-[var(--color-miss)]"
            : "text-[var(--color-text)]"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function Inline({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className={`mt-2 font-mono font-medium tabular-nums leading-none ${
          highlight ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        }`}
        style={{ fontSize: "clamp(36px, 5vw, 56px)" }}
      >
        {value}
      </div>
    </div>
  );
}

function NavLink({
  href,
  label,
  accent = false,
}: {
  href: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        accent
          ? "text-[var(--color-accent)] transition-opacity hover:opacity-80"
          : "text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      }
    >
      {label}
    </Link>
  );
}
