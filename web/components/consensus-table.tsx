"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ConsensusRow } from "@/lib/consensus";
import { cn } from "@/lib/utils";

interface Props {
  rows: ConsensusRow[];
}

export function ConsensusTable({ rows }: Props) {
  const [query, setQuery] = useState("");
  const [topOnly, setTopOnly] = useState(false);
  const [minCount, setMinCount] = useState(2);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (topOnly && !r.inTop50) return false;
      if (r.citedBySlrs < minCount) return false;
      if (q && !r.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, query, topOnly, minCount]);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter title…"
          className="flex-1 min-w-[12rem] rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <label className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--color-text-muted)]">
          <input
            type="checkbox"
            checked={topOnly}
            onChange={(e) => setTopOnly(e.target.checked)}
            className="accent-[var(--color-accent)]"
          />
          Top-50 only
        </label>
        <label className="inline-flex items-center gap-2 font-mono text-[11px] text-[var(--color-text-muted)]">
          Min cites
          <input
            type="number"
            value={minCount}
            min={1}
            max={20}
            onChange={(e) => setMinCount(Math.max(1, Number(e.target.value)))}
            className="w-14 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-1.5 py-0.5 text-center tabular-nums focus:border-[var(--color-accent)] focus:outline-none"
          />
        </label>
      </div>
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <div className="border-b border-[var(--color-border)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {filtered.length.toLocaleString()} of {rows.length.toLocaleString()}
        </div>
        <div className="max-h-[640px] overflow-y-auto">
          {filtered.slice(0, 200).map((p, i) => (
            <motion.div
              key={p.paper_key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.25,
                delay: Math.min(i * 0.008, 0.3),
              }}
              className={cn(
                "flex items-start gap-3 border-b border-[var(--color-border)] px-4 py-2.5 last:border-b-0",
                p.inTop50 && "bg-[var(--color-accent-soft)]/30",
              )}
            >
              <div className="flex-1 min-w-0">
                <div className="line-clamp-2 text-sm text-[var(--color-text)]">
                  {p.title}
                </div>
                <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-faint)]">
                  {p.year ?? "-"}
                  {p.citationCount > 0 && ` · ${p.citationCount.toLocaleString()} cites`}
                  {p.inTop50 && p.rank && (
                    <span className="ml-2 text-[var(--color-accent)]">
                      TOP-50 #{p.rank}
                    </span>
                  )}
                </div>
              </div>
              <span
                className={cn(
                  "shrink-0 font-mono text-sm font-semibold tabular-nums",
                  p.citedBySlrs >= 5
                    ? "text-[var(--color-accent)]"
                    : p.citedBySlrs >= 3
                      ? "text-[var(--color-warn)]"
                      : "text-[var(--color-text-muted)]",
                )}
              >
                {p.citedBySlrs}×
              </span>
            </motion.div>
          ))}
          {filtered.length > 200 && (
            <div className="px-4 py-2 text-center font-mono text-[10px] text-[var(--color-text-subtle)]">
              showing first 200 of {filtered.length}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
