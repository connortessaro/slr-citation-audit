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
        How much do two reviews share?
      </h1>
      <p className="mt-3 max-w-3xl text-sm text-[var(--color-text-muted)]">
        For any two reviews: how many references they share divided by how
        many references they have between them. 100% would mean they cite
        the same papers; 0% means they cite completely different ones.
      </p>

      <ComparePicker picks={picks} initialPairs={pairs} />
    </div>
  );
}
