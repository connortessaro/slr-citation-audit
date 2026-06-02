"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import type { Paper, MissedPairRow, RankRow } from "@/lib/data";
import { cn } from "@/lib/utils";
import { RankBreakdown } from "./rank-breakdown";

interface Props {
  title: string;
  paperKey: string;
  year: number | null;
  venue: string;
  coverage: number; // 0–100
  hits: number;
  misses: number;
  eligible: number;
  refCount: number;
  refs: Paper[];
  hitsList: Paper[];
  missedFromTop: Paper[];
  missedPairs: MissedPairRow[];
  rank: RankRow | null;
}

type Tab = "hits" | "missed" | "refs";

function CoverageGauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const tone =
    pct >= 30
      ? "var(--color-accent)"
      : pct >= 15
        ? "var(--color-warn)"
        : "var(--color-miss)";

  return (
    <div className="flex items-center gap-4">
      <div className="relative h-2 w-48 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${clamped}%` }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: tone }}
        />
      </div>
      <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: tone }}>
        {clamped.toFixed(1)}%
      </div>
    </div>
  );
}

function PaperRow({ p, badge }: { p: Paper; badge?: string }) {
  const authors = (p.authors ?? []).slice(0, 3).join(", ");
  const more = (p.authors?.length ?? 0) > 3 ? ` +${(p.authors?.length ?? 0) - 3}` : "";
  return (
    <div className="group flex items-start gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="line-clamp-2 text-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
          {p.title || "(no title)"}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-faint)]">
          {authors}
          {more}
          {p.year ? ` · ${p.year}` : ""}
          {p.venue ? ` · ${p.venue}` : ""}
        </div>
      </div>
      {p.citationCount !== undefined && p.citationCount > 0 && (
        <span className="shrink-0 font-mono text-[11px] tabular-nums text-[var(--color-text-subtle)]">
          {p.citationCount.toLocaleString()} cites
        </span>
      )}
      {badge && (
        <span className="shrink-0 rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]">
          {badge}
        </span>
      )}
    </div>
  );
}

export function SLRDetail({
  title,
  paperKey,
  year,
  venue,
  coverage,
  hits,
  misses,
  eligible,
  refCount,
  refs,
  hitsList,
  missedFromTop,
  rank,
}: Props) {
  const [tab, setTab] = useState<Tab>("hits");

  const tabs: { key: Tab; label: string; count: number; tone?: string }[] = [
    { key: "hits", label: "Hits", count: hits, tone: "var(--color-accent)" },
    { key: "missed", label: "Missed from top-50", count: misses, tone: "var(--color-miss)" },
    { key: "refs", label: "All references", count: refs.length },
  ];

  const list =
    tab === "hits"
      ? hitsList
      : tab === "missed"
        ? missedFromTop
        : refs;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Link
        href="/slrs"
        className="mb-4 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] lg:hidden"
      >
        ← All SLRs
      </Link>
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        SLR · {paperKey}
      </div>
      <h1 className="mt-2 text-balance text-2xl font-semibold tracking-tight text-[var(--color-text)]">
        {title}
      </h1>
      <div className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">
        {year ?? "-"} · {venue || "Unknown venue"}
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-[1.5fr_1fr]">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Date-controlled coverage
          </div>
          <div className="mt-3">
            <CoverageGauge pct={coverage} />
          </div>
          <div className="mt-5 grid grid-cols-3 gap-4 font-mono text-xs">
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                Hits
              </div>
              <div className="mt-1 text-lg tabular-nums text-[var(--color-accent)]">
                {hits}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                Missed
              </div>
              <div className="mt-1 text-lg tabular-nums text-[var(--color-miss)]">
                {misses}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                Eligible
              </div>
              <div className="mt-1 text-lg tabular-nums text-[var(--color-text)]">
                {eligible}
              </div>
            </div>
          </div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            References extracted
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[var(--color-text)]">
            {refCount}
          </div>
          <p className="mt-3 text-xs text-[var(--color-text-muted)]">
            From Semantic Scholar reference lists. All references the
            review made, not just the ones in the canonical top 50.
          </p>
        </div>
      </div>

      {/* Rank breakdown */}
      {rank && (
        <div className="mt-10">
          <RankBreakdown row={rank} />
        </div>
      )}

      {/* Tabs */}
      <div className="mt-10">
        <div className="flex gap-1 border-b border-[var(--color-border)]">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative -mb-px border-b-2 px-4 py-2.5 font-mono text-xs uppercase tracking-[0.08em] transition-colors",
                tab === t.key
                  ? "border-[var(--color-accent)] text-[var(--color-text)]"
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
              )}
            >
              {t.label}
              <span
                className="ml-2 font-mono text-[10px] tabular-nums"
                style={{ color: t.tone ?? "var(--color-text-subtle)" }}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-2">
          {list.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-subtle)]">
              No papers in this list.
            </div>
          ) : (
            list.map((p, i) => (
              <motion.div
                key={p.paper_key + i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.25,
                  delay: Math.min(i * 0.01, 0.3),
                }}
              >
                <PaperRow p={p} badge={tab === "hits" ? "hit" : undefined} />
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
