"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

interface Props {
  children: React.ReactNode;
  delay?: number;
  /** y-offset in px to start from. Default 12. */
  y?: number;
  /** margin to trigger; tighter = earlier. Default "-12%". */
  margin?: string;
}

export function ScrollReveal({
  children,
  delay = 0,
  y = 12,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-12%" });
  const reduced = useReducedMotion();

  if (reduced) return <div ref={ref}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{
        duration: 0.6,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  );
}
