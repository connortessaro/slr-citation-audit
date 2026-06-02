"use client";

import { motion } from "motion/react";
import { useMemo, useState } from "react";
import type { ComparePair } from "@/lib/consensus";
import { cn } from "@/lib/utils";

interface Pick {
  id: string;
  title: string;
  year: number;
  coverage: number;
}

interface Props {
  picks: Pick[];
  initialPairs: ComparePair[];
}

function jaccardClient(setsA: Set<string>, setsB: Set<string>) {
  let shared = 0;
  for (const k of setsA) if (setsB.has(k)) shared++;
  return {
    shared,
    uniqueA: setsA.size - shared,
    uniqueB: setsB.size - shared,
    jaccard: shared / (setsA.size + setsB.size - shared || 1),
  };
}

export function ComparePicker({ picks, initialPairs }: Props) {
  const sorted = useMemo(
    () => [...picks].sort((a, b) => b.coverage - a.coverage),
    [picks],
  );
  const [aId, setAId] = useState<string>(sorted[0]?.id ?? "");
  const [bId, setBId] = useState<string>(sorted[1]?.id ?? "");

  const pickById = useMemo(
    () => new Map(picks.map((p) => [p.id, p])),
    [picks],
  );

  const pair = useMemo(() => {
    if (!aId || !bId || aId === bId) return null;
    return initialPairs.find(
      (p) =>
        (p.a === aId && p.b === bId) || (p.a === bId && p.b === aId),
    );
  }, [aId, bId, initialPairs]);

  return (
    <div className="mt-10 grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Picker
            label="SLR A"
            value={aId}
            onChange={setAId}
            picks={sorted}
            tone="accent"
          />
          <Picker
            label="SLR B"
            value={bId}
            onChange={setBId}
            picks={sorted}
            tone="muted"
          />
        </div>

        {pair && (
          <motion.div
            key={`${aId}-${bId}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="mt-6 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-6"
          >
            <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
              Reference overlap
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <div className="font-mono text-5xl font-semibold tabular-nums text-[var(--color-accent)]">
                {(pair.jaccard * 100).toFixed(1)}%
              </div>
              <div className="font-mono text-sm text-[var(--color-text-subtle)]">
                of references shared
              </div>
            </div>

            {/* Venn-ish bar */}
            <div className="mt-5">
              <div className="relative h-6 overflow-hidden rounded-md bg-[var(--color-bg-elevated)]">
                <div
                  className="absolute inset-y-0 left-0 bg-[var(--color-text-faint)]/40"
                  style={{ width: `${(pair.uniqueA / (pair.uniqueA + pair.shared + pair.uniqueB)) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 bg-[var(--color-accent)]/70"
                  style={{
                    left: `${(pair.uniqueA / (pair.uniqueA + pair.shared + pair.uniqueB)) * 100}%`,
                    width: `${(pair.shared / (pair.uniqueA + pair.shared + pair.uniqueB)) * 100}%`,
                  }}
                />
                <div
                  className="absolute inset-y-0 right-0 bg-[var(--color-text-faint)]/40"
                  style={{ width: `${(pair.uniqueB / (pair.uniqueA + pair.shared + pair.uniqueB)) * 100}%` }}
                />
              </div>
              <div className="mt-2 grid grid-cols-3 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                <span>Only A · {pair.uniqueA}</span>
                <span className="text-center text-[var(--color-accent)]">
                  Shared · {pair.shared}
                </span>
                <span className="text-right">Only B · {pair.uniqueB}</span>
              </div>
            </div>
          </motion.div>
        )}

        {!pair && aId !== bId && (
          <div className="mt-6 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)]/20 p-6 text-sm text-[var(--color-text-muted)]">
            No shared references. These SLRs cite completely different
            sets of papers, or one has no extracted references in the
            dataset.
          </div>
        )}
      </div>

      <div>
        <h2 className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          Most similar pairs
        </h2>
        <ul className="mt-3 space-y-1 max-h-[420px] overflow-y-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-2">
          {initialPairs.slice(0, 20).map((p) => {
            const a = pickById.get(p.a);
            const b = pickById.get(p.b);
            if (!a || !b) return null;
            const active =
              (p.a === aId && p.b === bId) || (p.a === bId && p.b === aId);
            return (
              <li key={`${p.a}-${p.b}`}>
                <button
                  onClick={() => {
                    setAId(p.a);
                    setBId(p.b);
                  }}
                  className={cn(
                    "w-full rounded-md px-2.5 py-2 text-left transition-colors",
                    active
                      ? "bg-[var(--color-surface)] ring-1 ring-inset ring-[var(--color-accent-soft)]"
                      : "hover:bg-[var(--color-surface)]/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs tabular-nums text-[var(--color-accent)]">
                      {(p.jaccard * 100).toFixed(1)}%
                    </span>
                    <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
                      shared {p.shared}
                    </span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--color-text)]">
                    {a.title}
                  </div>
                  <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-muted)]">
                    × {b.title}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Picker({
  label,
  value,
  onChange,
  picks,
  tone,
}: {
  label: string;
  value: string;
  onChange: (id: string) => void;
  picks: Pick[];
  tone: "accent" | "muted";
}) {
  return (
    <label className="block">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "mt-2 w-full rounded-md border bg-[var(--color-surface)] px-3 py-2 text-sm transition-colors focus:outline-none",
          tone === "accent"
            ? "border-[var(--color-accent-soft)] text-[var(--color-text)]"
            : "border-[var(--color-border)] text-[var(--color-text-muted)]",
        )}
      >
        {picks.map((p) => (
          <option key={p.id} value={p.id} className="bg-[var(--color-bg)]">
            {p.year} · {p.title.slice(0, 80)}
            {p.title.length > 80 ? "…" : ""} · {p.coverage.toFixed(0)}%
          </option>
        ))}
      </select>
    </label>
  );
}
