import { getRefsMap, getSLRs, getOverlap, getTopCited } from "./data";

export interface ConsensusRow {
  paper_key: string;
  title: string;
  year: number | null;
  citationCount: number;
  citedBySlrs: number;
  inTop50: boolean;
  rank?: number;
}

let _consensus: ConsensusRow[] | null = null;

/**
 * For every paper referenced by any SLR, count how many SLRs cite it.
 * Sorted desc by SLR-citation count.
 */
export function getConsensus(): ConsensusRow[] {
  if (_consensus) return _consensus;
  const refsMap = getRefsMap();
  const top = getTopCited();
  const topKeys = new Set(top.map((t) => t.paper_key));
  const topRankByKey = new Map(top.map((t) => [t.paper_key, t.rank]));

  // Collect first occurrence of each paper + count appearances
  const seen = new Map<
    string,
    {
      paper_key: string;
      title: string;
      year: number | null;
      citationCount: number;
      count: number;
    }
  >();

  for (const [, refs] of Object.entries(refsMap)) {
    for (const r of refs) {
      const existing = seen.get(r.paper_key);
      if (existing) {
        existing.count += 1;
      } else {
        seen.set(r.paper_key, {
          paper_key: r.paper_key,
          title: r.title || "(no title)",
          year: r.year ?? null,
          citationCount: r.citationCount ?? 0,
          count: 1,
        });
      }
    }
  }

  const rows: ConsensusRow[] = Array.from(seen.values()).map((v) => ({
    paper_key: v.paper_key,
    title: v.title,
    year: v.year,
    citationCount: v.citationCount,
    citedBySlrs: v.count,
    inTop50: topKeys.has(v.paper_key),
    rank: topRankByKey.get(v.paper_key),
  }));

  rows.sort((a, b) => {
    if (b.citedBySlrs !== a.citedBySlrs) return b.citedBySlrs - a.citedBySlrs;
    return b.citationCount - a.citationCount;
  });

  _consensus = rows;
  return _consensus;
}

/* ------------------------------------------------------------------ */
/* Compare - pairwise Jaccard of SLR reference sets                   */
/* ------------------------------------------------------------------ */

export interface ComparePair {
  a: string;          // slr_id A
  b: string;          // slr_id B
  shared: number;
  uniqueA: number;
  uniqueB: number;
  jaccard: number;    // 0-1
}

let _pairs: ComparePair[] | null = null;

export function getComparePairs(limit = 200): ComparePair[] {
  if (_pairs) return _pairs.slice(0, limit);

  const refsMap = getRefsMap();
  const slrs = getSLRs();
  const overlap = getOverlap();
  const ids = overlap.map((o) => o.slr_id);

  const sets = new Map<string, Set<string>>();
  for (const id of ids) {
    const refs = refsMap[id] ?? [];
    sets.set(id, new Set(refs.map((r) => r.paper_key)));
  }

  const out: ComparePair[] = [];
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const A = sets.get(ids[i])!;
      const B = sets.get(ids[j])!;
      if (A.size === 0 || B.size === 0) continue;
      let shared = 0;
      for (const k of A) if (B.has(k)) shared++;
      const uniqueA = A.size - shared;
      const uniqueB = B.size - shared;
      const jaccard = shared / (A.size + B.size - shared || 1);
      if (shared > 0) {
        out.push({
          a: ids[i],
          b: ids[j],
          shared,
          uniqueA,
          uniqueB,
          jaccard,
        });
      }
    }
  }
  out.sort((a, b) => b.jaccard - a.jaccard);
  _pairs = out;
  return _pairs.slice(0, limit);
}

export function getPairwise(a: string, b: string): ComparePair | null {
  const refsMap = getRefsMap();
  const A = new Set((refsMap[a] ?? []).map((r) => r.paper_key));
  const B = new Set((refsMap[b] ?? []).map((r) => r.paper_key));
  if (A.size === 0 && B.size === 0) return null;
  let shared = 0;
  for (const k of A) if (B.has(k)) shared++;
  const uniqueA = A.size - shared;
  const uniqueB = B.size - shared;
  const jaccard = shared / (A.size + B.size - shared || 1);
  return { a, b, shared, uniqueA, uniqueB, jaccard };
}
