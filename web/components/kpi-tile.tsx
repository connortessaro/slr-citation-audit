"use client";

import { motion, useInView, useMotionValue, useTransform, animate } from "motion/react";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface KpiTileProps {
  label: string;
  value: number;
  suffix?: string;
  format?: "int" | "pct";
  highlight?: boolean;
  delay?: number;
}

export function KpiTile({
  label,
  value,
  suffix,
  format = "int",
  highlight = false,
  delay = 0,
}: KpiTileProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const mv = useMotionValue(0);
  const display = useTransform(mv, (n) => {
    if (format === "pct") return `${(n * 100).toFixed(1)}%`;
    return Math.round(n).toLocaleString();
  });

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, value, {
      duration: 1.1,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [inView, value, mv, delay]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 8 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "relative rounded-md border border-[var(--color-border)] bg-[var(--color-surface)]/40 p-5 backdrop-blur-sm",
        "transition-colors hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface)]/70",
      )}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <motion.div
          className={cn(
            "font-mono text-3xl font-semibold tabular-nums",
            highlight
              ? "text-[var(--color-accent)]"
              : "text-[var(--color-text)]",
          )}
        >
          {display}
        </motion.div>
        {suffix && (
          <span className="text-sm text-[var(--color-text-subtle)]">
            {suffix}
          </span>
        )}
      </div>
    </motion.div>
  );
}
