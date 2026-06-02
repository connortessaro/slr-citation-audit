"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useState } from "react";
import type { OverlapRow, TopCitedPaper } from "@/lib/data";
import { cn } from "@/lib/utils";

type SlrStatus = OverlapRow & { cited: boolean; eligible: boolean };

interface Props {
  paper: TopCitedPaper;
  citingSlrs: SlrStatus[];
  missingEligible: SlrStatus[];
  ineligible: SlrStatus[];
  slrTitleByKey: Record<string, string>;
}

type Tab = "cited" | "missed" | "ineligible";

function SlrRow({
  s,
  titleByKey,
  tone,
}: {
  s: SlrStatus;
  titleByKey: Record<string, string>;
  tone: "accent" | "miss" | "subtle";
}) {
  const title = titleByKey[s.slr_id] || s.slr_title || "(no title)";
  return (
    <Link
      href={`/slrs/${encodeURIComponent(s.slr_id)}`}
      className="group flex items-start gap-3 border-b border-[var(--color-border)] py-3 last:border-b-0"
    >
      <div className="flex-1 min-w-0">
        <div className="line-clamp-2 text-sm text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
          {title}
        </div>
        <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-faint)]">
          {s.slr_year || "-"} · {s.slr_venue} · coverage{" "}
          {s.coverage_pct.toFixed(1)}%
        </div>
      </div>
      <span
        className={cn(
          "shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider",
          tone === "accent" &&
            "bg-[var(--color-accent-soft)] text-[var(--color-accent)]",
          tone === "miss" && "bg-[var(--color-miss)]/10 text-[var(--color-miss)]",
          tone === "subtle" && "text-[var(--color-text-subtle)]",
        )}
      >
        {tone === "accent" ? "cited" : tone === "miss" ? "missed" : "n/a"}
      </span>
    </Link>
  );
}

export function PaperDetail({
  paper,
  citingSlrs,
  missingEligible,
  ineligible,
  slrTitleByKey,
}: Props) {
  const [tab, setTab] = useState<Tab>("missed");

  const tabs: { key: Tab; label: string; count: number; tone: "accent" | "miss" | "subtle" }[] = [
    { key: "cited", label: "Cited by", count: citingSlrs.length, tone: "accent" },
    { key: "missed", label: "Missed by (eligible)", count: missingEligible.length, tone: "miss" },
    { key: "ineligible", label: "Ineligible", count: ineligible.length, tone: "subtle" },
  ];
  const list =
    tab === "cited" ? citingSlrs : tab === "missed" ? missingEligible : ineligible;

  const eligibleSlrs = citingSlrs.length + missingEligible.length;
  const recall =
    eligibleSlrs > 0 ? (citingSlrs.length / eligibleSlrs) * 100 : 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-8">
      <Link
        href="/papers"
        className="mb-4 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--color-text-muted)] hover:text-[var(--color-accent)] lg:hidden"
      >
        ← All top cited
      </Link>
      <div className="flex items-center gap-3">
        <span className="rounded bg-[var(--color-accent-soft)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--color-accent)]">
          #{paper.rank}
        </span>
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          Top cited · {paper.paper_key}
        </div>
      </div>
      <h1 className="mt-3 text-balance text-2xl font-semibold tracking-tight text-[var(--color-text)]">
        {paper.title || "(no title)"}
      </h1>
      <div className="mt-2 font-mono text-xs text-[var(--color-text-muted)]">
        {(paper.authors ?? []).slice(0, 5).join(", ")}
        {(paper.authors?.length ?? 0) > 5 && ` +${(paper.authors?.length ?? 0) - 5}`}
        {paper.year ? ` · ${paper.year}` : ""}
        {paper.venue ? ` · ${paper.venue}` : ""}
      </div>
      {paper.citationCount !== undefined && paper.citationCount > 0 && (
        <div className="mt-2 font-mono text-xs text-[var(--color-text-subtle)]">
          {paper.citationCount.toLocaleString()} citations on Semantic Scholar
        </div>
      )}

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Cited by
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[var(--color-accent)]">
            {citingSlrs.length}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[var(--color-text-faint)]">
            of {eligibleSlrs} eligible SLRs
          </div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Recall
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[var(--color-text)]"
          >
            {recall.toFixed(1)}%
          </motion.div>
          <div className="mt-1 font-mono text-[11px] text-[var(--color-text-faint)]">
            among eligible SLRs
          </div>
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
            Ineligible
          </div>
          <div className="mt-2 font-mono text-3xl font-semibold tabular-nums text-[var(--color-text-subtle)]">
            {ineligible.length}
          </div>
          <div className="mt-1 font-mono text-[11px] text-[var(--color-text-faint)]">
            SLRs predating this paper
          </div>
        </div>
      </div>

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
              <span className="ml-2 font-mono text-[10px] tabular-nums text-[var(--color-text-subtle)]">
                {t.count}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-2">
          {list.length === 0 ? (
            <div className="py-12 text-center text-sm text-[var(--color-text-subtle)]">
              No SLRs in this list.
            </div>
          ) : (
            list.map((s) => (
              <SlrRow
                key={s.slr_id}
                s={s}
                titleByKey={slrTitleByKey}
                tone={tab === "cited" ? "accent" : tab === "missed" ? "miss" : "subtle"}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
