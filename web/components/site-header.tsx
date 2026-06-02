"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/about", label: "About" },
  { href: "/slrs", label: "SLRs" },
  { href: "/papers", label: "Top cited" },
  { href: "/consensus", label: "Consensus" },
  { href: "/compare", label: "Compare" },
  { href: "/graph", label: "Graph" },
  { href: "/method", label: "Method" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const openPalette = () =>
    window.dispatchEvent(new Event("slr-cmdk-open"));

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
        <Link
          href="/"
          aria-label="slr.audit home"
          className="flex items-center gap-2 font-mono text-sm font-medium tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block size-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent-glow)]"
          />
          slr.audit
        </Link>

        <nav
          aria-label="Primary"
          className="hidden items-center gap-1 text-sm md:flex"
        >
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "text-[var(--color-text)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-pill"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 -z-10 rounded-md bg-[var(--color-surface)]"
                  />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] sm:gap-2">
          {/* Mobile search icon — same event as ⌘K */}
          <button
            type="button"
            aria-label="Open search"
            onClick={openPalette}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] md:hidden"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
            >
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          {/* Desktop ⌘K button */}
          <button
            type="button"
            aria-label="Open command palette"
            onClick={openPalette}
            className="hidden items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text)] md:inline-flex"
          >
            <kbd className="font-mono">⌘K</kbd>
            <span className="text-[var(--color-text-faint)]">search</span>
          </button>

          <ThemeToggle />

          <a
            href="https://github.com/connortessaro/slr-citation-audit"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="hidden rounded-md px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)] sm:inline-flex"
          >
            github
          </a>

          <MobileNav items={NAV} />
        </div>
      </div>
    </header>
  );
}
