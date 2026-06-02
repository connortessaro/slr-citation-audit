import Link from "next/link";
import { getOverviewStats, getRanked } from "@/lib/data";

export function SiteFooter() {
  const stats = getOverviewStats();
  const candidates = getRanked().length;
  const candidateNote =
    candidates > stats.slrCount
      ? ` (of ${candidates} candidates)`
      : "";

  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 px-4 py-6 font-mono text-[11px] text-[var(--color-text-subtle)] sm:gap-4 sm:px-6 md:flex-row md:items-center md:gap-4">
        <div className="break-words">
          {stats.slrCount} published reviews{candidateNote} ·{" "}
          {stats.topCount} most-cited papers ·{" "}
          <code className="text-[var(--color-text-muted)]">paper_key</code>{" "}
          (DOI → SS id → title) · static build, no runtime
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/connortessaro/slr-citation-audit"
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            className="hover:text-[var(--color-text)]"
          >
            github
          </a>
          <span aria-hidden className="text-[var(--color-text-faint)]">·</span>
          <Link href="/method" className="hover:text-[var(--color-text)]">
            method
          </Link>
        </div>
      </div>
    </footer>
  );
}
