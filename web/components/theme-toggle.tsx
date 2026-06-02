"use client";

import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

type Theme = "dark" | "light";

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");
  const reduced = useReducedMotion();

  useEffect(() => {
    const stored = (typeof localStorage !== "undefined"
      ? (localStorage.getItem("slr-theme") as Theme | null)
      : null) ?? "dark";
    setTheme(stored);
    document.documentElement.setAttribute("data-theme", stored);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("slr-theme", next);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="relative grid h-7 w-12 items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] transition-colors hover:border-[var(--color-border-strong)]"
    >
      <motion.span
        layout={!reduced}
        transition={
          reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 500, damping: 32 }
        }
        className={`absolute top-1/2 size-5 -translate-y-1/2 rounded-full ${
          theme === "dark"
            ? "left-1 bg-[var(--color-text-muted)]"
            : "left-[26px] bg-[var(--color-accent)]"
        }`}
      />
    </button>
  );
}
