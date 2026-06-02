"use client";

import { motion, useInView, useMotionValue, useTransform, animate } from "motion/react";
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
  duration = 1.4,
  delay = 0,
}: Props) {
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
      duration,
      delay,
      ease: [0.16, 1, 0.3, 1],
    });
    return controls.stop;
  }, [inView, value, mv, duration, delay]);

  return (
    <div ref={ref} className="flex items-baseline gap-3">
      <motion.div
        className="font-mono font-medium leading-none tracking-[-0.04em] text-[var(--color-text)]"
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
