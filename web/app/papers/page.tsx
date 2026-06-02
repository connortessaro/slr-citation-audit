export default function PapersIndexPage() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="max-w-md text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          Top cited
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          Pick a canonical paper
        </h1>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Each entry is a top-cited paper in the technical-debt subfield on
          Semantic Scholar. Open one to see which SLRs cite it vs miss it,
          filtered by the SLR&apos;s own publication-year horizon.
        </p>
      </div>
    </div>
  );
}
