export default function SLRsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center p-12">
      <div className="max-w-md text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          SLRs
        </div>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          Pick a review to inspect
        </h1>
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">
          Each entry on the left is a Systematic Literature Review in the
          technical-debt subfield. Open one to see its references, which
          top-50 papers it hits or misses, and its date-controlled coverage.
        </p>
      </div>
    </div>
  );
}
