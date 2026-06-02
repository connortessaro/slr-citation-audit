/**
 * Static data loader - reads pipeline JSON outputs at build time.
 * Adapts to the on-disk schema where keys are `_paper_key`/`_rank`/etc.
 */

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(process.cwd(), "..");
const PROC = path.join(REPO_ROOT, "data", "processed");

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */

export interface Paper {
  paper_key: string;
  paperId?: string | null;
  doi?: string | null;
  title: string;
  year?: number | null;
  venue?: string | null;
  authors?: string[];
  citationCount?: number;
  abstract?: string | null;
}

export interface SLR extends Paper {
  classification?: string;
  source?: string;
}

export interface SLRReference extends Paper {
  /* references inherit Paper shape */
}

export interface OverlapRow {
  slr_id: string;          // paper_key of the SLR
  slr_title: string;
  slr_year: number;
  slr_venue: string;
  slr_type: string;
  n_refs: number;
  eligible_top_n: number;
  hits: number;
  misses: number;
  coverage_pct: number;     // 0–100 (NOT 0–1)
}

export interface TopCitedPaper extends Paper {
  rank: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */

function tryReadJSON<T>(...candidates: string[]): T | null {
  for (const rel of candidates) {
    const full = path.isAbsolute(rel) ? rel : path.join(PROC, rel);
    try {
      return JSON.parse(fs.readFileSync(full, "utf-8")) as T;
    } catch {
      // try next
    }
  }
  return null;
}

function tryReadCSV(...candidates: string[]): Record<string, string>[] {
  for (const rel of candidates) {
    const full = path.isAbsolute(rel) ? rel : path.join(PROC, rel);
    try {
      const text = fs.readFileSync(full, "utf-8").replace(/\r\n/g, "\n");
      const [header, ...rows] = text.trim().split("\n");
      const cols = parseCSVRow(header).map((c) => c.trim());
      return rows.map((r) => {
        const vals = parseCSVRow(r);
        const o: Record<string, string> = {};
        cols.forEach((c, i) => (o[c] = (vals[i] ?? "").trim()));
        return o;
      });
    } catch {
      // try next
    }
  }
  return [];
}

function parseCSVRow(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQ = !inQ;
    } else if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizePaper(p: Record<string, unknown>): Paper {
  const key = String(p.paper_key ?? p._paper_key ?? p.paperId ?? "");
  const authorsRaw = Array.isArray(p.authors) ? p.authors : [];
  const authors = (authorsRaw as Array<string | { name?: string }>).map((a) =>
    typeof a === "string" ? a : a?.name ?? "",
  );
  let doi: string | null = (p.doi ?? null) as string | null;
  if (!doi && p.externalIds && typeof p.externalIds === "object") {
    doi = (p.externalIds as Record<string, string>).DOI ?? null;
  }
  return {
    paper_key: key,
    title: String(p.title ?? ""),
    year: typeof p.year === "number" ? p.year : null,
    venue: typeof p.venue === "string" ? p.venue : null,
    paperId: (p.paperId ?? null) as string | null,
    doi,
    authors,
    citationCount:
      typeof p.citationCount === "number" ? p.citationCount : 0,
    abstract: typeof p.abstract === "string" ? p.abstract : null,
  };
}

/* ------------------------------------------------------------------ */
/* Loaders (memoized)                                                 */
/* ------------------------------------------------------------------ */

let _slrs: SLR[] | null = null;
export function getSLRs(): SLR[] {
  if (_slrs) return _slrs;
  const raw = tryReadJSON<unknown>(
    "ss/slr_corpus.json",
    "slr_corpus.json",
  );
  const arr = Array.isArray(raw)
    ? raw
    : ((raw as { papers?: unknown[] } | null)?.papers ?? []);
  _slrs = (arr as Record<string, unknown>[])
    .map((p) => ({
      ...normalizePaper(p),
      classification: (p._classification_type ?? p.classification ?? "") as string,
      source: (p._source ?? p.source ?? "") as string,
    }))
    .filter((p) => p.title);
  return _slrs;
}

let _refs: Record<string, Paper[]> | null = null;
export function getRefsMap(): Record<string, Paper[]> {
  if (_refs) return _refs;
  const raw = tryReadJSON<unknown>(
    "ss/slr_references.json",
    "slr_references.json",
  );
  if (!raw || typeof raw !== "object") {
    _refs = {};
    return _refs;
  }
  // Two possible shapes:
  //   { paper_key: [refs...] }  (current on-disk)
  //   [{ paper_key, references: [...] }]  (alternate)
  if (Array.isArray(raw)) {
    const out: Record<string, Paper[]> = {};
    for (const r of raw as Array<{ paper_key: string; references: Record<string, unknown>[] }>) {
      out[r.paper_key] = (r.references ?? []).map(normalizePaper);
    }
    _refs = out;
    return _refs;
  }
  const out: Record<string, Paper[]> = {};
  for (const [k, v] of Object.entries(raw as Record<string, Record<string, unknown>[]>)) {
    out[k] = (v ?? []).map(normalizePaper);
  }
  _refs = out;
  return _refs;
}

export function getRefsForSLR(paper_key: string): Paper[] {
  return getRefsMap()[paper_key] ?? [];
}

let _top: TopCitedPaper[] | null = null;
export function getTopCited(): TopCitedPaper[] {
  if (_top) return _top;
  const raw = tryReadJSON<unknown>(
    "top_cited_techdebt.json",
    "ss/top_cited_techdebt.json",
    "top_cited_techdebt_top100.json",
  );
  const arr = Array.isArray(raw)
    ? raw
    : ((raw as { papers?: unknown[] } | null)?.papers ?? []);
  _top = (arr as Record<string, unknown>[]).map((p, i) => ({
    ...normalizePaper(p),
    rank: typeof p._rank === "number" ? p._rank : i + 1,
  }));
  return _top;
}

let _overlap: OverlapRow[] | null = null;
export function getOverlap(): OverlapRow[] {
  if (_overlap) return _overlap;
  const rows = tryReadCSV("ss/overlap_matrix.csv", "overlap_matrix.csv");
  _overlap = rows.map((r) => ({
    slr_id: r.slr_id ?? r.paper_key ?? "",
    slr_title: r.slr_title ?? r.title ?? "",
    slr_year: Number(r.slr_year ?? r.year) || 0,
    slr_venue: r.slr_venue ?? r.venue ?? "",
    slr_type: r.slr_type ?? "",
    n_refs: Number(r.n_refs ?? r.ref_count) || 0,
    eligible_top_n: Number(r.eligible_top_n ?? r.eligible) || 0,
    hits: Number(r.hits) || 0,
    misses: Number(r.misses) || 0,
    coverage_pct: Number(r.coverage_pct) || 0,
  }));
  return _overlap;
}

/* ------------------------------------------------------------------ */
/* Ranker (stage 06)                                                  */
/* ------------------------------------------------------------------ */

export interface RankDims {
  coverage: number;
  semantic: number;
  authority: number;
  diversity: number;
  llm_judge: number;
}

export interface RankRow {
  slr_key: string;
  slr_title: string;
  slr_venue: string;
  slr_year: number;
  rank: number;
  composite: number;       // 0-1, final weighted score
  raw: RankDims;            // raw per-dim values (different scales)
  normalized: RankDims;     // min-max normalized 0-1
  n_refs: number;
  n_refs_embedded: number;
  judge_justification: string | null;
}

let _ranked: RankRow[] | null = null;
export function getRanked(): RankRow[] {
  if (_ranked) return _ranked;
  const raw = tryReadJSON<unknown>(
    "ranked_slrs.json",
    "ss/ranked_slrs.json",
  );
  if (!Array.isArray(raw)) {
    _ranked = [];
    return _ranked;
  }
  _ranked = (raw as RankRow[]).slice().sort((a, b) => a.rank - b.rank);
  return _ranked;
}

export function getRankFor(slr_key: string): RankRow | null {
  return getRanked().find((r) => r.slr_key === slr_key) ?? null;
}

export interface MissedPairRow {
  slr_id: string;
  paper_key: string;
  title: string;
  reason?: string;
}
let _missed: MissedPairRow[] | null = null;
export function getMissedPairs(): MissedPairRow[] {
  if (_missed) return _missed;
  const rows = tryReadCSV("missed_pairs.csv", "ss/missed_pairs.csv");
  _missed = rows.map((r) => ({
    slr_id: r.slr_id ?? "",
    paper_key: r.paper_key ?? r.missed_paper_key ?? "",
    title: r.title ?? r.missed_title ?? "",
    reason: r.reason ?? "",
  }));
  return _missed;
}

/* ------------------------------------------------------------------ */
/* Aggregates                                                         */
/* ------------------------------------------------------------------ */

export interface OverviewStats {
  slrCount: number;
  topCount: number;
  slrsWithRefs: number;
  meanCoveragePct: number;     // already 0–100
  medianCoveragePct: number;
  zeroCoverage: number;
  totalRefs: number;
  dataComplete: boolean;
}

export function getOverviewStats(): OverviewStats {
  const slrs = getSLRs();
  const top = getTopCited();
  const overlap = getOverlap();
  const refsMap = getRefsMap();

  const covs = overlap
    .filter((o) => o.eligible_top_n > 0)
    .map((o) => o.coverage_pct)
    .sort((a, b) => a - b);
  const mean =
    covs.length === 0
      ? 0
      : covs.reduce((s, v) => s + v, 0) / covs.length;
  const median =
    covs.length === 0
      ? 0
      : covs.length % 2
        ? covs[(covs.length - 1) / 2]
        : (covs[covs.length / 2 - 1] + covs[covs.length / 2]) / 2;

  const totalRefs = Object.values(refsMap).reduce(
    (s, refs) => s + refs.length,
    0,
  );

  return {
    slrCount: slrs.length,
    topCount: top.length,
    slrsWithRefs: Object.keys(refsMap).filter(
      (k) => (refsMap[k] ?? []).length > 0,
    ).length,
    meanCoveragePct: mean,
    medianCoveragePct: median,
    zeroCoverage: covs.filter((c) => c === 0).length,
    totalRefs,
    dataComplete: slrs.length > 0 && top.length > 0 && overlap.length > 0,
  };
}

/* ------------------------------------------------------------------ */
/* Coverage histogram bins                                            */
/* ------------------------------------------------------------------ */

export function getCoverageHistogram(binCount = 10): {
  bins: number[];
  counts: number[];
} {
  const overlap = getOverlap().filter((o) => o.eligible_top_n > 0);
  const bins: number[] = [];
  for (let i = 0; i <= binCount; i++) bins.push((i / binCount) * 100);
  const counts = new Array(binCount).fill(0);
  for (const o of overlap) {
    const idx = Math.min(
      binCount - 1,
      Math.max(0, Math.floor((o.coverage_pct / 100) * binCount)),
    );
    counts[idx]++;
  }
  return { bins, counts };
}
