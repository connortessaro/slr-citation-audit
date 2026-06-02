export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg)]">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-[var(--color-text-subtle)]">
        <div className="flex items-center gap-3 font-mono">
          <span>
            Data <span className="text-[var(--color-text-faint)]">·</span>{" "}
            <code className="text-[var(--color-text-muted)]">
              data/processed/ss/
            </code>
          </span>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span>
            Match{" "}
            <code className="text-[var(--color-text-muted)]">paper_key</code>{" "}
            <span className="text-[var(--color-text-faint)]">
              (DOI → SS id → title)
            </span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span>Semantic Scholar</span>
          <span className="text-[var(--color-text-faint)]">·</span>
          <span>tech-debt corpus</span>
        </div>
      </div>
    </footer>
  );
}
