"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { useEffect, useRef } from "react";

interface Props {
  value: number;
  format?: "pct" | "int";
  suffix?: string;
  duration?: number;
  delay?: number;
}

export function BigStat({
  value,
  format = "int",
  suffix,
  duration = 0.6,
  delay = 0,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const reduced = useReducedMotion();
  const mv = useMotionValue(reduced ? value : 0);
  const display = useTransform(mv, (n) => {
    if (format === "pct") return `${(n * 100).toFixed(1)}%`;
    return Math.round(n).toLocaleString();
  });

  useEffect(() => {
    if (reduced) {
      mv.set(value);
      return;
    }
    if (!inView) return;
    const controls = animate(mv, value, {
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [inView, value, mv, duration, delay, reduced]);

  return (
    <div ref={ref} className="flex items-baseline gap-3">
      <motion.div
        className="font-mono font-medium leading-none tracking-[-0.03em] text-[var(--color-text)]"
        style={{ fontSize: "clamp(96px, 18vw, 220px)" }}
      >
        {display}
      </motion.div>
      {suffix && (
        <span className="font-mono text-2xl text-[var(--color-text-subtle)]">
          {suffix}
        </span>
      )}
    </div>
  );
}
