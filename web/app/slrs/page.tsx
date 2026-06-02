import Link from "next/link";
import { getOverlap, getSLRs } from "@/lib/data";

export default function SLRsIndexPage() {
  const overlap = getOverlap();
  const slrs = getSLRs();
  const titleByKey = new Map(slrs.map((s) => [s.paper_key, s.title]));

  const eligible = overlap.filter((o) => o.eligible_top_n > 0);
  const sorted = [...eligible].sort((a, b) => b.coverage_pct - a.coverage_pct);
  const top3 = sorted.slice(0, 3);
  const worst3 = sorted.slice(-3).reverse();

  return (
    <div className="mx-auto max-w-3xl px-10 py-16">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
        SLRs
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
        {eligible.length} reviews, ranked by canonical recall
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
        Pick from the sidebar for a single review&apos;s coverage gauge,
        hits, and full reference list. Highlights below.
      </p>

      <section className="mt-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Best 3 covered
        </div>
        <ol className="mt-4 space-y-3">
          {top3.map((o) => (
            <Row key={o.slr_id} o={o} titleByKey={titleByKey} tone="accent" />
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-miss)]">
          Worst 3 covered (non-zero)
        </div>
        <ol className="mt-4 space-y-3">
          {worst3.map((o) => (
            <Row key={o.slr_id} o={o} titleByKey={titleByKey} tone="miss" />
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({
  o,
  titleByKey,
  tone,
}: {
  o: { slr_id: string; slr_title: string; slr_year: number; coverage_pct: number };
  titleByKey: Map<string, string>;
  tone: "accent" | "miss";
}) {
  return (
    <li>
      <Link
        href={`/slrs/${encodeURIComponent(o.slr_id)}`}
        className="group flex items-baseline gap-4 border-b border-[var(--color-border)] py-3 hover:border-[var(--color-border-strong)]"
      >
        <span
          className="w-16 shrink-0 font-mono text-lg tabular-nums"
          style={{
            color:
              tone === "accent"
                ? "var(--color-accent)"
                : "var(--color-miss)",
          }}
        >
          {o.coverage_pct.toFixed(1)}%
        </span>
        <span className="flex-1 line-clamp-2 text-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
          {titleByKey.get(o.slr_id) || o.slr_title}
        </span>
        <span className="shrink-0 font-mono text-xs text-[var(--color-text-faint)]">
          {o.slr_year}
        </span>
      </Link>
    </li>
  );
}
