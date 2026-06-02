import { getOverlap, getRefsMap, getTopCited, getSLRs } from "./data";

export interface GraphNode {
  id: string;
  label: string;
  kind: "slr" | "top";
  coverage?: number;       // for SLRs (0-100)
  rank?: number;            // for top papers
  year?: number;
  hits?: number;
  citationCount?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/**
 * Build the bipartite citation network used by /graph.
 * Nodes = SLRs + top-cited papers. Links = SLR --references--> top paper
 * only for "hit" pairs (SLR cited the top paper).
 */
export function buildGraph(): GraphData {
  const overlap = getOverlap();
  const refsMap = getRefsMap();
  const top = getTopCited();
  const slrs = getSLRs();
  const slrTitleByKey = new Map(slrs.map((s) => [s.paper_key, s.title]));

  const topKeys = new Set(top.map((t) => t.paper_key));

  const nodes: GraphNode[] = [];
  for (const o of overlap) {
    nodes.push({
      id: o.slr_id,
      label: slrTitleByKey.get(o.slr_id) || o.slr_title || o.slr_id,
      kind: "slr",
      coverage: o.coverage_pct,
      year: o.slr_year || undefined,
      hits: o.hits,
    });
  }
  for (const t of top) {
    nodes.push({
      id: t.paper_key,
      label: t.title || t.paper_key,
      kind: "top",
      rank: t.rank,
      year: t.year || undefined,
      citationCount: t.citationCount,
    });
  }

  // Dedup (some SLRs might also appear in top-cited)
  const seen = new Set<string>();
  const uniqueNodes = nodes.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });

  const links: GraphLink[] = [];
  for (const o of overlap) {
    const refs = refsMap[o.slr_id] ?? [];
    for (const r of refs) {
      if (topKeys.has(r.paper_key)) {
        links.push({ source: o.slr_id, target: r.paper_key });
      }
    }
  }

  return { nodes: uniqueNodes, links };
}
