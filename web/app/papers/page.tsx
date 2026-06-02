import Link from "next/link";
import { getRefsMap, getTopCited } from "@/lib/data";

export default function PapersIndexPage() {
  const top = getTopCited();
  const refsMap = getRefsMap();

  const sorted = [...top].sort(
    (a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0),
  );
  const top3 = sorted.slice(0, 3);

  // Per paper: how many SLRs cite it
  const slrCountByKey = new Map<string, number>();
  for (const p of top) {
    let n = 0;
    for (const refs of Object.values(refsMap)) {
      if (refs.some((r) => r.paper_key === p.paper_key)) n++;
    }
    slrCountByKey.set(p.paper_key, n);
  }

  const mostMissed = [...top]
    .sort(
      (a, b) =>
        (slrCountByKey.get(a.paper_key) ?? 0) -
        (slrCountByKey.get(b.paper_key) ?? 0),
    )
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-3xl px-10 py-16">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-subtle)]">
        Top cited
      </div>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
        {top.length} canonical papers in the corpus
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-relaxed text-[var(--color-text-muted)]">
        Pick from the sidebar for a single paper&apos;s recall across the
        review corpus. Highlights below.
      </p>

      <section className="mt-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
          Most cited on Semantic Scholar
        </div>
        <ol className="mt-4 space-y-3">
          {top3.map((p) => (
            <Row
              key={p.paper_key}
              p={p}
              metric={`${p.citationCount?.toLocaleString() ?? 0} cites`}
            />
          ))}
        </ol>
      </section>

      <section className="mt-12">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-miss)]">
          Most-missed canonical papers
        </div>
        <ol className="mt-4 space-y-3">
          {mostMissed.map((p) => (
            <Row
              key={p.paper_key}
              p={p}
              metric={`${slrCountByKey.get(p.paper_key) ?? 0} of ${Object.keys(refsMap).length} SLRs cite`}
              tone="miss"
            />
          ))}
        </ol>
      </section>
    </div>
  );
}

function Row({
  p,
  metric,
  tone = "accent",
}: {
  p: { paper_key: string; title: string; year?: number | null; rank?: number };
  metric: string;
  tone?: "accent" | "miss";
}) {
  return (
    <li>
      <Link
        href={`/papers/${encodeURIComponent(p.paper_key)}`}
        className="group flex items-baseline gap-4 border-b border-[var(--color-border)] py-3 hover:border-[var(--color-border-strong)]"
      >
        <span
          className="w-12 shrink-0 font-mono text-sm tabular-nums"
          style={{
            color:
              tone === "accent"
                ? "var(--color-accent)"
                : "var(--color-miss)",
          }}
        >
          #{p.rank ?? "?"}
        </span>
        <span className="flex-1 line-clamp-2 text-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
          {p.title}
        </span>
        <span className="shrink-0 font-mono text-[11px] text-[var(--color-text-muted)]">
          {metric}
        </span>
      </Link>
    </li>
  );
}
