/**
 * Load pipeline outputs and build indexes for the overlap explorer.
 */

export const DATA_PATHS = {
  corpus: "/data/processed/ss/slr_corpus.json",
  refs: "/data/processed/ss/slr_references.json",
  top50: "/data/processed/top_cited_techdebt.json",
  top100: "/data/processed/top_cited_techdebt_top100.json",
  meta: "/data/processed/top_cited_techdebt_meta.json",
  methodsDoc: "/docs/research_paper_methods_snapshot.md",
};

export const DEFAULT_SETTINGS = {
  benchmarkSize: 50,
  cohort: "all",
  topPass: "all",
};

export function filterByYear(topCited, cutoffYear) {
  if (cutoffYear == null || cutoffYear === "") return topCited.filter((p) => p.year != null);
  const y = Number(cutoffYear);
  return topCited.filter((p) => {
    if (p.year == null) return false;
    return Number(p.year) <= y;
  });
}

export function cohortMatch(slrYear, cohort) {
  if (cohort === "all" || slrYear == null || slrYear === "") return true;
  const y = Number(slrYear);
  if (cohort === "2015-2019") return y >= 2015 && y <= 2019;
  if (cohort === "2020+") return y >= 2020;
  return true;
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

export async function loadExplorerBase(onProgress) {
  onProgress?.("Fetching pipeline data…");
  const [corpus, refsBySlr, top50, top100, meta] = await Promise.all([
    fetchJson(DATA_PATHS.corpus, "SLR corpus", onProgress),
    fetchJson(DATA_PATHS.refs, "reference lists", onProgress),
    fetchJson(DATA_PATHS.top50, "top-cited (50)", onProgress),
    fetchJson(DATA_PATHS.top100, "top-cited (100)", onProgress),
    fetchJson(DATA_PATHS.meta, "top-cited meta", onProgress).catch(() => null),
  ]);

  return { corpus, refsBySlr, top50, top100, meta };
}

/** @deprecated use loadExplorerBase + buildModel */
export async function loadExplorerData(onProgress) {
  const base = await loadExplorerBase(onProgress);
  return buildModel(base, DEFAULT_SETTINGS);
}

function slrKey(slr) {
  return slr._paper_key || slr.paper_key;
}

function filterTopByPass(topCited, topPass) {
  if (topPass === "all") return topCited;
  return topCited.filter((p) => p._pass === topPass);
}

function computeCohortSummary(slrs) {
  const buckets = [
    { id: "2015-2019", label: "2015–2019", lo: 2015, hi: 2019 },
    { id: "2020+", label: "2020+", lo: 2020, hi: 2099 },
  ];
  return buckets.map((b) => {
    const subset = slrs.filter((s) => {
      const y = s.slr.year;
      return y != null && Number(y) >= b.lo && Number(y) <= b.hi;
    });
    const cov = subset.map((s) => s.coveragePct).filter((v) => Number.isFinite(v));
    const mean = cov.length ? cov.reduce((a, v) => a + v, 0) / cov.length : null;
    const sorted = [...cov].sort((a, x) => a - x);
    const median = sorted.length
      ? sorted.length % 2
        ? sorted[Math.floor(sorted.length / 2)]
        : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : null;
    return {
      ...b,
      n: subset.length,
      meanCoverage: mean,
      medianCoverage: median,
    };
  });
}

export function buildModel(base, settings = DEFAULT_SETTINGS) {
  const benchmarkSize = settings.benchmarkSize === 100 ? 100 : 50;
  const topCitedRaw = benchmarkSize === 100 ? base.top100 : base.top50;
  const topCited = filterTopByPass(topCitedRaw, settings.topPass || "all");

  const topByKey = new Map();
  for (const p of topCited) {
    const k = p._paper_key;
    if (k) topByKey.set(k, p);
  }

  const allSlrs = base.corpus
    .map((slr) => {
      const key = slrKey(slr);
      const refs = base.refsBySlr[key] || [];
      const refKeys = new Set(refs.map((r) => r.paper_key).filter(Boolean));
      const eligible = filterByYear(topCited, slr.year);
      const eligibleHits = [];
      const eligibleMisses = [];
      for (const p of eligible) {
        const pk = p._paper_key;
        if (refKeys.has(pk)) eligibleHits.push(p);
        else eligibleMisses.push(p);
      }
      const computedCoverage = eligible.length ? (eligibleHits.length / eligible.length) * 100 : null;
      return {
        key,
        slr,
        refs,
        refKeys,
        refCount: refKeys.size,
        eligible,
        eligibleHits,
        eligibleMisses,
        overlap: {},
        coveragePct: computedCoverage,
      };
    })
    .filter((s) => s.refCount > 0);

  const slrs = allSlrs.filter((s) => cohortMatch(s.slr.year, settings.cohort));
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

  const covVals = slrs.map((s) => s.coveragePct).filter((v) => Number.isFinite(v));
  const summary = {
    slrCount: slrs.length,
    slrCountAll: allSlrs.length,
    topCount: topCited.length,
    benchmarkSize,
    cohort: settings.cohort,
    topPass: settings.topPass,
    withRefs: slrs.filter((s) => s.refCount > 0).length,
    meanCoverage: covVals.length ? covVals.reduce((a, v) => a + v, 0) / covVals.length : 0,
    medianCoverage: median(covVals),
    zeroCoverage: slrs.filter((s) => s.coveragePct === 0).length,
    uniqueCitedPapers: consensusPapers.length,
    maxConsensusCites: consensusPapers[0]?.citingCount ?? 0,
    cohortStats: computeCohortSummary(allSlrs),
  };

  const metaPrimary = base.meta?.primary ?? null;
  const settingsLabel = describeSettings(settings, metaPrimary);

  return {
    slrs,
    allSlrs,
    topPapers,
    topCited,
    topByKey,
    consensusPapers,
    pairwiseOverlaps,
    summary,
    meta: base.meta,
    settings,
    settingsLabel,
  };
}

export function describeSettings(settings, metaPrimary) {
  const n = settings.benchmarkSize === 100 ? 100 : 50;
  const half = n / 2;
  const cut = metaPrimary?.cutoff_year_inclusive_established ?? "≤ as_of−4";
  let label = `Top ${n} two-pass · ${half} established (${cut}) + ${half} recent`;
  if (settings.topPass && settings.topPass !== "all") {
    label += ` · pass=${settings.topPass}`;
  }
  if (settings.cohort && settings.cohort !== "all") {
    label += ` · SLRs ${settings.cohort}`;
  }
  label += " · date-controlled coverage";
  return label;
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
          inTopBenchmark: Boolean(topPaper),
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

/** Minimal markdown → HTML for Methods tab */
export function renderMethodsHtml(markdown) {
  const lines = markdown.split("\n");
  const parts = [];
  let inTable = false;
  let tableRows = [];

  function flushTable() {
    if (!tableRows.length) return;
    const [head, ...body] = tableRows;
    const cells = (row) => row.split("|").slice(1, -1).map((c) => c.trim());
    parts.push("<table class='methods-table'><thead><tr>");
    cells(head).forEach((h) => {
      parts.push(`<th>${escapeHtml(h)}</th>`);
    });
    parts.push("</tr></thead><tbody>");
    body.forEach((row) => {
      if (/^[\s|:-]+$/.test(row)) return;
      parts.push("<tr>");
      cells(row).forEach((c) => {
        parts.push(`<td>${escapeHtml(c)}</td>`);
      });
      parts.push("</tr>");
    });
    parts.push("</tbody></table>");
    tableRows = [];
    inTable = false;
  }

  for (const line of lines) {
    if (line.startsWith("|")) {
      inTable = true;
      tableRows.push(line);
      continue;
    }
    if (inTable) flushTable();
    if (line.startsWith("## ")) {
      parts.push(`<h2>${escapeHtml(line.slice(3))}</h2>`);
    } else if (line.startsWith("### ")) {
      parts.push(`<h3>${escapeHtml(line.slice(4))}</h3>`);
    } else if (line.startsWith("- ")) {
      parts.push(`<li>${escapeHtml(line.slice(2))}</li>`);
    } else if (line.trim() === "---") {
      parts.push("<hr />");
    } else if (line.trim()) {
      parts.push(`<p>${escapeHtml(line)}</p>`);
    }
  }
  if (inTable) flushTable();
  return parts.join("\n");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
