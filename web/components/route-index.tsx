"use client";

import { motion, useInView } from "motion/react";
import Link from "next/link";
import { useRef } from "react";

const ROUTES = [
  { n: "/slrs", t: "Per-review coverage gauge plus reference list" },
  { n: "/papers", t: "Per-paper SLR recall plus miss list" },
  { n: "/consensus", t: "Most-cited paper across SLRs" },
  { n: "/compare", t: "Pairwise reference overlap (Jaccard)" },
  { n: "/graph", t: "Citation network in 3D" },
];

export function RouteIndex() {
  const ref = useRef<HTMLOListElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });

  return (
    <ol
      ref={ref}
      className="grid grid-cols-1 gap-0 font-mono text-sm sm:grid-cols-2 lg:grid-cols-1"
    >
      {ROUTES.map((x, i) => (
        <motion.li
          key={x.n}
          initial={{ opacity: 0, y: 6 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: 0.5,
            delay: i * 0.06,
            ease: [0.16, 1, 0.3, 1],
          }}
          className="group"
        >
          <Link
            href={x.n}
            className="flex items-baseline gap-6 border-b border-[var(--color-border)] py-4 transition-colors hover:border-[var(--color-accent-soft)]"
          >
            <span className="w-10 shrink-0 font-mono text-2xl tabular-nums leading-none text-[var(--color-accent)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="w-24 shrink-0 text-[var(--color-text)] transition-colors group-hover:text-[var(--color-accent)]">
              {x.n}
            </span>
            <span className="flex-1 text-[var(--color-text-muted)] transition-colors group-hover:text-[var(--color-text)]">
              {x.t}
            </span>
            <span className="text-[var(--color-text-faint)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]">
              →
            </span>
          </Link>
        </motion.li>
      ))}
    </ol>
  );
}
