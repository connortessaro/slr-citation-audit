import { getConsensus } from "@/lib/consensus";
import { ConsensusTable } from "@/components/consensus-table";

export default function ConsensusPage() {
  const rows = getConsensus();
  const total = rows.length;
  const inTop = rows.filter((r) => r.inTop50).length;
  const top10 = rows.slice(0, 10);

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        Consensus
      </div>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
        Which papers do most reviews agree on?
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-[var(--color-text-muted)]">
        For every paper cited by any review, this counts how many reviews
        cite it. Papers cited by many reviews are the &ldquo;everyone
        agrees this matters&rdquo; layer of the field. Papers tagged
        TOP-50 also appear in the canonical most-cited list on Semantic
        Scholar.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Unique papers referenced" value={total} />
        <Stat label="Also in canonical top 50" value={inTop} highlight />
        <Stat
          label="Most reviews citing one paper"
          value={rows[0]?.citedBySlrs ?? 0}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_2fr]">
        <div>
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
            Top consensus papers
          </h2>
          <ol className="mt-4 space-y-3">
            {top10.map((p, i) => (
              <li
                key={p.paper_key}
                className="flex items-start gap-3 border-b border-[var(--color-border)] pb-3 last:border-b-0"
              >
                <span className="mt-0.5 w-6 shrink-0 font-mono text-xs tabular-nums text-[var(--color-text-faint)]">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  <div className="line-clamp-2 text-sm text-[var(--color-text)]">
                    {p.title}
                  </div>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-faint)]">
                    {p.year ?? "—"}
                    {p.inTop50 && (
                      <span className="ml-2 rounded bg-[var(--color-accent-soft)] px-1 py-0.5 text-[var(--color-accent)]">
                        TOP-50 #{p.rank}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 font-mono text-xs tabular-nums text-[var(--color-accent)]">
                  {p.citedBySlrs}×
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <ConsensusTable rows={rows} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-4">
      <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div
        className={`mt-2 font-mono text-3xl font-semibold tabular-nums ${
          highlight ? "text-[var(--color-accent)]" : "text-[var(--color-text)]"
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}
