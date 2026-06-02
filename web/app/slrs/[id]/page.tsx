import { notFound } from "next/navigation";
import {
  getOverlap,
  getRefsForSLR,
  getSLRs,
  getTopCited,
  getMissedPairs,
  getRankFor,
} from "@/lib/data";
import { SLRDetail } from "@/components/slr-detail";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function SLRDetailPage({ params }: Params) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);
  const overlap = getOverlap().find((o) => o.slr_id === id);
  const slr = getSLRs().find((s) => s.paper_key === id);

  if (!overlap && !slr) notFound();

  const refs = getRefsForSLR(id);
  const topCited = getTopCited();
  const topKeys = new Set(topCited.map((t) => t.paper_key));

  const hits = refs.filter((r) => topKeys.has(r.paper_key));
  const refKeys = new Set(refs.map((r) => r.paper_key));
  const missedFromTop = topCited.filter((t) => !refKeys.has(t.paper_key));

  const missedPairs = getMissedPairs().filter((m) => m.slr_id === id);
  const rank = getRankFor(id);

  return (
    <SLRDetail
      title={slr?.title ?? overlap?.slr_title ?? "(no title)"}
      paperKey={id}
      year={slr?.year ?? overlap?.slr_year ?? null}
      venue={slr?.venue ?? overlap?.slr_venue ?? ""}
      coverage={overlap?.coverage_pct ?? 0}
      hits={overlap?.hits ?? hits.length}
      misses={overlap?.misses ?? missedFromTop.length}
      eligible={overlap?.eligible_top_n ?? topCited.length}
      refCount={overlap?.n_refs ?? refs.length}
      refs={refs}
      hitsList={hits}
      missedFromTop={missedFromTop}
      missedPairs={missedPairs}
      rank={rank}
    />
  );
}
