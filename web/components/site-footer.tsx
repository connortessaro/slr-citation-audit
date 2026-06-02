import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 font-mono text-[11px] text-[var(--color-text-subtle)]">
        <div>
          74 SLRs · 50 canonical papers ·{" "}
          <code className="text-[var(--color-text-muted)]">paper_key</code>{" "}
          (DOI → SS id → title) · static build, no runtime
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/connortessaro/slr-citation-audit"
            target="_blank"
            rel="noreferrer"
            className="hover:text-[var(--color-text)]"
          >
            github
          </a>
          <span className="text-[var(--color-text-faint)]">·</span>
          <Link href="/method" className="hover:text-[var(--color-text)]">
            method
          </Link>
        </div>
      </div>
    </footer>
  );
}
