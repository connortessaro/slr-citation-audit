import { getComparePairs } from "@/lib/consensus";
import { getOverlap, getSLRs } from "@/lib/data";
import { ComparePicker } from "@/components/compare-picker";

export default function ComparePage() {
  const pairs = getComparePairs(50);
  const overlap = getOverlap();
  const slrs = getSLRs();
  const titleByKey = new Map(slrs.map((s) => [s.paper_key, s.title]));

  const picks = overlap.map((o) => ({
    id: o.slr_id,
    title: titleByKey.get(o.slr_id) || o.slr_title || "(no title)",
    year: o.slr_year,
    coverage: o.coverage_pct,
  }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-12">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
        Compare
      </div>
      <h1 className="mt-2 text-balance text-3xl font-semibold tracking-tight text-[var(--color-text)] sm:text-4xl">
        Pairwise SLR reference overlap
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-[var(--color-text-muted)]">
        Jaccard similarity between the reference sets of any two SLRs.
        Suggests which reviews are working from the same source corpus.
      </p>

      <ComparePicker picks={picks} initialPairs={pairs} />
    </div>
  );
}
