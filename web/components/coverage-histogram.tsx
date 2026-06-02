"use client";

import { motion } from "motion/react";
import { useMemo } from "react";

interface Props {
  bins: number[]; // length N+1 — bin edges (0..100)
  counts: number[]; // length N
  height?: number;
}

export function CoverageHistogram({ bins, counts, height = 200 }: Props) {
  const max = Math.max(1, ...counts);
  const labels = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < counts.length; i++) {
      out.push(`${Math.round(bins[i])}–${Math.round(bins[i + 1])}%`);
    }
    return out;
  }, [bins, counts]);

  return (
    <div className="w-full">
      <div
        className="flex items-end gap-1"
        style={{ height }}
        aria-label="Coverage histogram"
      >
        {counts.map((c, i) => {
          const h = (c / max) * 100;
          const isActive = c > 0;
          return (
            <div key={i} className="group relative flex-1">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                transition={{
                  duration: 0.7,
                  delay: 0.05 * i,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className={
                  isActive
                    ? "rounded-t-sm bg-[var(--color-accent)]/80 transition-colors group-hover:bg-[var(--color-accent)]"
                    : "rounded-t-sm bg-[var(--color-border-strong)] transition-colors group-hover:bg-[var(--color-text-faint)]"
                }
                style={{ minHeight: c > 0 ? 4 : 1 }}
              >
                <div className="-mt-5 text-center font-mono text-[10px] text-[var(--color-text-subtle)]">
                  {c > 0 ? c : ""}
                </div>
              </motion.div>
              <div className="pointer-events-none absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[10px] text-[var(--color-text-faint)] opacity-0 group-hover:opacity-100">
                {labels[i]}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6 flex justify-between font-mono text-[10px] text-[var(--color-text-subtle)]">
        <span>0%</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>100%</span>
      </div>
    </div>
  );
}
