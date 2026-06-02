"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { OverlapRow } from "@/lib/data";
import { cn } from "@/lib/utils";

interface Props {
  rows: OverlapRow[];
}

type SortKey = "slr_year" | "n_refs" | "hits" | "coverage_pct" | "slr_title";
type SortDir = "asc" | "desc";

function coverageClass(pct: number): string {
  if (pct >= 30) return "text-[var(--color-accent)]";
  if (pct >= 15) return "text-[var(--color-warn)]";
  if (pct > 0) return "text-[var(--color-text-muted)]";
  return "text-[var(--color-text-faint)]";
}

function shortId(id: string): string {
  // doi:10.1234/abc -> doi:10.1234… for tighter display
  if (id.startsWith("doi:")) return id.slice(0, 32) + (id.length > 32 ? "…" : "");
  if (id.startsWith("ss:")) return "ss:" + id.slice(3, 11) + "…";
  return id.slice(0, 24);
}

export function SLRTable({ rows }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("coverage_pct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [query, setQuery] = useState("");

  const sorted = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter(
          (r) =>
            r.slr_title.toLowerCase().includes(q) ||
            r.slr_venue.toLowerCase().includes(q) ||
            r.slr_id.toLowerCase().includes(q),
        )
      : rows;
    return [...filtered].sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }, [rows, sortKey, sortDir, query]);

  const headers: { key: SortKey; label: string; right?: boolean }[] = [
    { key: "slr_year", label: "Year" },
    { key: "slr_title", label: "Title" },
    { key: "n_refs", label: "Refs", right: true },
    { key: "hits", label: "Hits", right: true },
    { key: "coverage_pct", label: "Cov", right: true },
  ];

  const toggleSort = (k: SortKey) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir(
        k === "slr_title" || k === "slr_year" ? "asc" : "desc",
      );
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          All SLRs · {sorted.length} of {rows.length}
        </h2>
        <input
          type="search"
          placeholder="Filter…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-48 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1 text-xs placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
        />
      </div>
      <div className="overflow-x-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-[var(--color-bg-elevated)]/95 backdrop-blur">
            <tr className="border-b border-[var(--color-border)]">
              {headers.map((h) => (
                <th
                  key={h.key}
                  onClick={() => toggleSort(h.key)}
                  className={cn(
                    "cursor-pointer select-none px-4 py-2.5 font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]",
                    h.right && "text-right",
                  )}
                >
                  {h.label}
                  {sortKey === h.key && (
                    <span className="ml-1 text-[var(--color-accent)]">
                      {sortDir === "asc" ? "↑" : "↓"}
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <motion.tr
                key={r.slr_id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.3,
                  delay: Math.min(i * 0.015, 0.4),
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="border-b border-[var(--color-border)] transition-colors hover:bg-[var(--color-surface-hover)]/60"
              >
                <td className="px-4 py-3 font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                  {r.slr_year || "—"}
                </td>
                <td className="max-w-[42rem] px-4 py-3">
                  <Link
                    href={`/slrs/${encodeURIComponent(r.slr_id)}`}
                    className="line-clamp-2 text-[var(--color-text)] hover:text-[var(--color-accent)] hover:underline"
                  >
                    {r.slr_title || "(no title)"}
                  </Link>
                  <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-faint)]">
                    {r.slr_venue} · {shortId(r.slr_id)}
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
                  {r.n_refs || "—"}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums text-[var(--color-text-muted)]">
                  {r.hits}
                </td>
                <td
                  className={cn(
                    "px-4 py-3 text-right font-mono font-medium tabular-nums",
                    coverageClass(r.coverage_pct),
                  )}
                >
                  {r.coverage_pct.toFixed(1)}%
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
