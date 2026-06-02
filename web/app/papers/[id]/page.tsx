import { notFound } from "next/navigation";
import {
  getOverlap,
  getRefsMap,
  getTopCited,
  getSLRs,
} from "@/lib/data";
import { PaperDetail } from "@/components/paper-detail";

interface Params {
  params: Promise<{ id: string }>;
}

export default async function PaperDetailPage({ params }: Params) {
  const { id: rawId } = await params;
  const id = decodeURIComponent(rawId);

  const top = getTopCited().find((p) => p.paper_key === id);
  if (!top) notFound();

  const refsMap = getRefsMap();
  const overlap = getOverlap();
  const slrs = getSLRs();
  const slrTitleByKey = new Map(slrs.map((s) => [s.paper_key, s.title]));
  const overlapBySlr = new Map(overlap.map((o) => [o.slr_id, o]));

  // For each SLR, did its refs include this paper?
  const slrStatus = overlap.map((o) => {
    const refs = refsMap[o.slr_id] ?? [];
    const cited = refs.some((r) => r.paper_key === id);
    // Eligibility: paper must have pub_year <= SLR pub_year
    const eligible = top.year != null && o.slr_year > 0 ? top.year <= o.slr_year : true;
    return { ...o, cited, eligible };
  });

  const citingSlrs = slrStatus.filter((s) => s.cited);
  const missingEligible = slrStatus.filter((s) => !s.cited && s.eligible);
  const ineligible = slrStatus.filter((s) => !s.eligible);

  return (
    <PaperDetail
      paper={top}
      citingSlrs={citingSlrs}
      missingEligible={missingEligible}
      ineligible={ineligible}
      slrTitleByKey={Object.fromEntries(slrTitleByKey)}
    />
  );
}
