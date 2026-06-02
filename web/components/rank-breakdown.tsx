"use client";

import { motion, useInView } from "motion/react";
import { useRef, useState } from "react";
import type { RankDims, RankRow } from "@/lib/data";
import { cn } from "@/lib/utils";

const DIM_META: Array<{
  key: keyof RankDims;
  label: string;
  blurb: string;
}> = [
  {
    key: "coverage",
    label: "Coverage",
    blurb: "% of canonical top-50 papers the SLR cites (date-controlled).",
  },
  {
    key: "semantic",
    label: "Semantic",
    blurb:
      "Mean cosine similarity between the SLR vector and its references' vectors. Qwen3-Embedding-0.6B.",
  },
  {
    key: "authority",
    label: "Authority",
    blurb: "Mean log(1 + citationCount) of the SLR's references.",
  },
  {
    key: "diversity",
    label: "Diversity",
    blurb:
      "0.5 * H(venues) + 0.5 * H(first authors). Shannon entropy of the bibliography.",
  },
  {
    key: "llm_judge",
    label: "LLM judge",
    blurb:
      "DeepSeek V3 rubric pass, temperature 0, cached per SLR via OpenRouter.",
  },
];

function fmt(n: number, dims: keyof RankRow["raw"]): string {
  if (dims === "coverage") return `${(n * 100).toFixed(1)}%`;
  return n.toFixed(3);
}

export function RankBreakdown({ row }: { row: RankRow }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inView = useInView(containerRef, { once: true, margin: "-10%" });
  const [open, setOpen] = useState(false);

  return (
    <div
      ref={containerRef}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-6"
    >
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
            Composite rank
          </div>
          <div className="mt-2 flex items-baseline gap-3">
            <div className="font-mono text-4xl font-medium tabular-nums text-[var(--color-text)]">
              #{row.rank}
            </div>
            <div className="font-mono text-sm text-[var(--color-text-subtle)]">
              of 74
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
            Composite score
          </div>
          <div className="mt-2 font-mono text-2xl font-medium tabular-nums text-[var(--color-accent)]">
            {(row.composite * 100).toFixed(1)}
          </div>
        </div>
      </div>

      <ol className="mt-6 space-y-3">
        {DIM_META.map((dim, i) => {
          const norm = row.normalized[dim.key];
          const raw = row.raw[dim.key];
          return (
            <li
              key={dim.key}
              className="grid grid-cols-[7.5rem_1fr_5rem] items-center gap-3"
            >
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
                {dim.label}
              </span>
              <div className="relative h-2 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={
                    inView ? { width: `${Math.max(0, Math.min(1, norm)) * 100}%` } : {}
                  }
                  transition={{
                    duration: 0.7,
                    delay: 0.1 + i * 0.06,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full",
                    dim.key === "llm_judge" && norm === 0
                      ? "bg-[var(--color-text-faint)]"
                      : "bg-[var(--color-accent)]",
                  )}
                />
              </div>
              <span className="text-right font-mono text-xs tabular-nums text-[var(--color-text-muted)]">
                {fmt(raw, dim.key)}
              </span>
            </li>
          );
        })}
      </ol>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-5 font-mono text-[11px] text-[var(--color-text-subtle)] hover:text-[var(--color-text)]"
      >
        {open ? "hide" : "what these mean →"}
      </button>
      {open && (
        <motion.dl
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-3 space-y-2 text-[11px] text-[var(--color-text-muted)]"
        >
          {DIM_META.map((d) => (
            <div key={d.key} className="flex gap-3">
              <dt className="w-24 shrink-0 font-mono uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                {d.label}
              </dt>
              <dd>{d.blurb}</dd>
            </div>
          ))}
        </motion.dl>
      )}

      {row.judge_justification && (
        <div className="mt-6 rounded border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/40 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-accent)]">
            Judge justification
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            {row.judge_justification}
          </p>
        </div>
      )}
    </div>
  );
}
