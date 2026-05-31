/**
 * Load pipeline outputs and build indexes for the overlap explorer.
 */

const DATA_PATHS = {
  corpus: "/data/processed/ss/slr_corpus.json",
  refs: "/data/processed/ss/slr_references.json",
  topCited: "/data/processed/top_cited_techdebt.json",
  overlap: "/data/processed/ss/overlap_matrix.csv",
};

export function filterByYear(topCited, cutoffYear) {
  if (cutoffYear == null || cutoffYear === "") return topCited.filter((p) => p.year != null);
  const y = Number(cutoffYear);
  return topCited.filter((p) => {
    if (p.year == null) return false;
    return Number(p.year) <= y;
  });
}

function parseCsv(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.replace(/\r$/, ""));
  if (!lines.length) return [];
  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const vals = parseCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (vals[i] ?? "").trim();
    });
    return row;
  });
}

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuotes = !inQuotes;
    } else if (c === "," && !inQuotes) {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

async function fetchJson(path, label, onProgress) {
  onProgress?.(`Loading ${label}…`);
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${label}: ${res.status} ${res.statusText}`);
  return res.json();
}

export async function loadExplorerData(onProgress) {
  onProgress?.("Fetching pipeline data…");
  const [corpus, refsBySlr, topCited, overlapText] = await Promise.all([
    fetchJson(DATA_PATHS.corpus, "SLR corpus", onProgress),
    fetchJson(DATA_PATHS.refs, "reference lists", onProgress),
    fetchJson(DATA_PATHS.topCited, "top-cited corpus", onProgress),
    (async () => {
      onProgress?.("Loading overlap matrix…");
      const res = await fetch(DATA_PATHS.overlap);
      if (!res.ok) throw new Error(`Failed to load overlap: ${res.status} ${res.statusText}`);
      return res.text();
    })(),
  ]);

  onProgress?.("Building indexes…");
  const overlapRows = parseCsv(overlapText);
  return buildModel(corpus, refsBySlr, topCited, overlapRows);
}

function slrKey(slr) {
  return slr._paper_key || slr.paper_key;
}

export function buildModel(corpus, refsBySlr, topCited, overlapRows) {
  const topByKey = new Map();
  for (const p of topCited) {
    const k = p._paper_key;
    if (k) topByKey.set(k, p);
  }

  const overlapBySlr = new Map();
  for (const row of overlapRows) {
    overlapBySlr.set(row.slr_id, {
      ...row,
      coverage_pct: row.coverage_pct === "" ? null : Number(row.coverage_pct),
      n_refs: Number(row.n_refs),
      eligible_top_n: Number(row.eligible_top_n),
      hits: Number(row.hits),
      misses: Number(row.misses),
    });
  }

  const slrs = corpus.map((slr) => {
    const key = slrKey(slr);
    const refs = refsBySlr[key] || [];
    const refKeys = new Set(refs.map((r) => r.paper_key).filter(Boolean));
    const eligible = filterByYear(topCited, slr.year);
    const eligibleHits = [];
    const eligibleMisses = [];
    for (const p of eligible) {
      const pk = p._paper_key;
      if (refKeys.has(pk)) eligibleHits.push(p);
      else eligibleMisses.push(p);
    }
    const ov = overlapBySlr.get(key) || {};
    const computedCoverage = eligible.length ? (eligibleHits.length / eligible.length) * 100 : null;
    const fromOverlap = ov.coverage_pct;
    const coveragePct = Number.isFinite(fromOverlap) ? fromOverlap : computedCoverage;
    return {
      key,
      slr,
      refs,
      refKeys,
      refCount: refKeys.size,
      eligible,
      eligibleHits,
      eligibleMisses,
      overlap: ov,
      coveragePct,
    };
  });

  slrs.sort((a, b) => (b.coveragePct ?? -1) - (a.coveragePct ?? -1));

  for (const s of slrs) {
    s.eligibleKeySet = new Set(s.eligible.map((e) => e._paper_key));
  }

  const topPapers = topCited.map((p) => {
    const key = p._paper_key;
    const citing = [];
    const missing = [];
    for (const s of slrs) {
      if (!s.eligibleKeySet.has(key)) continue;
      if (s.refKeys.has(key)) citing.push(s);
      else missing.push(s);
    }
    return {
      key,
      paper: p,
      citing,
      missing,
      citingCount: citing.length,
      eligibleSlrCount: citing.length + missing.length,
      missCount: missing.length,
    };
  });

  topPapers.sort((a, b) => (a.paper._rank ?? 999) - (b.paper._rank ?? 999));

  const consensusPapers = buildSlrCitedConsensus(slrs, topByKey);
  const pairwiseOverlaps = buildPairwiseOverlaps(slrs);

  const summary = {
    slrCount: slrs.length,
    topCount: topCited.length,
    withRefs: slrs.filter((s) => s.refCount > 0).length,
    meanCoverage:
      slrs.filter((s) => Number.isFinite(s.coveragePct)).reduce((a, s) => a + s.coveragePct, 0) /
        (slrs.filter((s) => Number.isFinite(s.coveragePct)).length || 1),
    medianCoverage: median(slrs.map((s) => s.coveragePct).filter((v) => Number.isFinite(v))),
    zeroCoverage: slrs.filter((s) => s.coveragePct === 0).length,
    uniqueCitedPapers: consensusPapers.length,
    maxConsensusCites: consensusPapers[0]?.citingCount ?? 0,
  };

  return { slrs, topPapers, topCited, topByKey, consensusPapers, pairwiseOverlaps, summary };
}

/** Papers cited by SLRs, ranked by how many SLRs cite each (consensus bibliography). */
export function buildSlrCitedConsensus(slrs, topByKey) {
  const byKey = new Map();
  for (const s of slrs) {
    const seenInSlr = new Set();
    for (const ref of s.refs) {
      const pk = ref.paper_key;
      if (!pk || seenInSlr.has(pk)) continue;
      seenInSlr.add(pk);
      let entry = byKey.get(pk);
      if (!entry) {
        const topPaper = topByKey.get(pk);
        entry = {
          key: pk,
          ref,
          citingSlrs: [],
          inTop50: Boolean(topPaper),
          topRank: topPaper?._rank ?? null,
        };
        byKey.set(pk, entry);
      }
      entry.citingSlrs.push(s);
    }
  }
  const papers = [...byKey.values()];
  for (const p of papers) {
    p.citingCount = p.citingSlrs.length;
    p.citingSlrs.sort((a, b) => (b.slr.year ?? 0) - (a.slr.year ?? 0));
  }
  papers.sort(
    (a, b) =>
      b.citingCount - a.citingCount ||
      (b.ref.citationCount ?? 0) - (a.ref.citationCount ?? 0) ||
      (a.ref.title || "").localeCompare(b.ref.title || "")
  );
  return papers;
}

/** Pairwise reference overlap between every SLR pair (sorted by Jaccard, descending). */
export function buildPairwiseOverlaps(slrs) {
  const withRefs = slrs.filter((s) => s.refCount > 0);
  const pairs = [];
  for (let i = 0; i < withRefs.length; i++) {
    for (let j = i + 1; j < withRefs.length; j++) {
      const a = withRefs[i];
      const b = withRefs[j];
      const sharedKeys = [];
      for (const k of a.refKeys) {
        if (b.refKeys.has(k)) sharedKeys.push(k);
      }
      const shared = sharedKeys.length;
      const union = a.refKeys.size + b.refKeys.size - shared;
      const minSize = Math.min(a.refKeys.size, b.refKeys.size);
      pairs.push({
        a,
        b,
        shared,
        sharedKeys,
        union,
        jaccard: union ? shared / union : 0,
        overlapCoef: minSize ? shared / minSize : 0,
      });
    }
  }
  pairs.sort(
    (x, y) =>
      y.jaccard - x.jaccard ||
      y.shared - x.shared ||
      (x.a.slr.title || "").localeCompare(y.a.slr.title || "")
  );
  return pairs;
}

export function pairwiseDetail(a, b) {
  const sharedKeys = new Set();
  for (const k of a.refKeys) {
    if (b.refKeys.has(k)) sharedKeys.add(k);
  }
  const onlyA = [...a.refKeys].filter((k) => !b.refKeys.has(k));
  const onlyB = [...b.refKeys].filter((k) => !a.refKeys.has(k));
  const refByKey = (s, k) => s.refs.find((r) => r.paper_key === k);
  return {
    shared: [...sharedKeys].map((k) => refByKey(a, k) || refByKey(b, k)).filter(Boolean),
    onlyA: onlyA.map((k) => refByKey(a, k)).filter(Boolean),
    onlyB: onlyB.map((k) => refByKey(b, k)).filter(Boolean),
    sharedCount: sharedKeys.size,
    union: a.refKeys.size + b.refKeys.size - sharedKeys.size,
    jaccard: a.refKeys.size + b.refKeys.size - sharedKeys.size
      ? sharedKeys.size / (a.refKeys.size + b.refKeys.size - sharedKeys.size)
      : 0,
    overlapCoef: Math.min(a.refKeys.size, b.refKeys.size)
      ? sharedKeys.size / Math.min(a.refKeys.size, b.refKeys.size)
      : 0,
  };
}

function median(vals) {
  if (!vals.length) return 0;
  const s = [...vals].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
