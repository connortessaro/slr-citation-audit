"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/", label: "Overview" },
  { href: "/slrs", label: "SLRs" },
  { href: "/papers", label: "Top cited" },
  { href: "/consensus", label: "Consensus" },
  { href: "/compare", label: "Compare" },
  { href: "/graph", label: "Graph" },
];

export function SiteHeader() {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-mono text-sm font-medium tracking-tight"
        >
          <span
            aria-hidden
            className="inline-block size-2 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent-glow)]"
          />
          slr.audit
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 transition-colors",
                  active
                    ? "text-[var(--color-text)] bg-[var(--color-surface)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <button
            type="button"
            aria-label="Open command palette"
            onClick={() => window.dispatchEvent(new Event("slr-cmdk-open"))}
            className="hidden items-center gap-1.5 rounded border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1 font-mono text-[10px] text-[var(--color-text-muted)] transition-colors hover:border-[var(--color-accent-soft)] hover:text-[var(--color-text)] md:inline-flex"
          >
            <kbd className="font-mono">⌘K</kbd>
            <span className="text-[var(--color-text-faint)]">search</span>
          </button>
          <a
            href="https://github.com/connortessaro/slr-citation-audit"
            target="_blank"
            rel="noreferrer"
            className="rounded-md px-2 py-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text)]"
          >
            github
          </a>
        </div>
      </div>
    </header>
  );
}
