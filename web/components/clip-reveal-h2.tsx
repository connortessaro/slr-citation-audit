"use client";

import { motion, useInView, useReducedMotion } from "motion/react";
import { useRef } from "react";

interface Props {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Clip-path "reveal from the left" entrance for big editorial headlines.
 * Used on the most-cited callout for the page's one deliberate cinema moment.
 */
export function ClipRevealH2({ children, className, style }: Props) {
  const ref = useRef<HTMLHeadingElement>(null);
  const inView = useInView(ref, { once: true, margin: "-10%" });
  const reduced = useReducedMotion();

  if (reduced) {
    return (
      <h2 ref={ref} className={className} style={style}>
        {children}
      </h2>
    );
  }

  return (
    <motion.h2
      ref={ref}
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={inView ? { clipPath: "inset(0 0% 0 0)" } : {}}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
      className={className}
      style={style}
    >
      {children}
    </motion.h2>
  );
}
