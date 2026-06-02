import {
  loadExplorerBase,
  buildModel,
  DEFAULT_SETTINGS,
  renderMethodsHtml,
  DATA_PATHS,
  pairwiseDetail,
} from "./data.js";
import {
  destroyCharts,
  renderCoverageHistogram,
  renderTopCitedBar,
  renderConsensusBar,
  resizeOverviewCharts,
} from "./charts.js";

let explorerBase = null;
let model = null;
let settings = { ...DEFAULT_SETTINGS };
let activeView = "overview";
let selectedSlrKey = null;
let selectedTopKey = null;
let selectedConsensusKey = null;
let slrDetailTab = "summary";
let topDetailTab = "summary";
let topMode = "benchmark";
let compareSlrA = null;
let compareSlrB = null;

const $ = (sel) => document.querySelector(sel);

function fmtYear(y) {
  return y == null || y === "" ? "—" : String(y);
}

function fmtPct(v) {
  return v == null ? "—" : `${Number(v).toFixed(1)}%`;
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function attrKey(key) {
  return String(key ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function keyFrom(el, name) {
  const raw = el?.dataset?.[name];
  return raw == null || raw === "" ? raw : raw;
}

function coverageClass(pct) {
  if (pct == null) return "badge-muted";
  if (pct === 0) return "badge-cov-0";
  if (pct < 10) return "badge-cov-1";
  if (pct < 20) return "badge-cov-2";
  if (pct < 30) return "badge-cov-3";
  if (pct < 40) return "badge-cov-4";
  return "badge-cov-5";
}

function formatKeyLink(pk) {
  if (!pk) return "—";
  const s = String(pk);
  if (s.startsWith("doi:")) {
    const doi = s.slice(4);
    const url = `https://doi.org/${encodeURIComponent(doi)}`;
    return `<a class="key-link" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(doi)}">DOI ↗</a>`;
  }
  if (s.startsWith("ss:")) {
    const id = s.slice(3);
    const url = `https://www.semanticscholar.org/paper/${encodeURIComponent(id)}`;
    return `<a class="key-link" href="${esc(url)}" target="_blank" rel="noopener" title="${esc(s)}">SS ↗</a>`;
  }
  return `<span class="key-link" title="${esc(s)}">Key</span>`;
}

function slrCohortContext(s) {
  const sorted = [...model.slrs].sort((a, b) => (a.coveragePct ?? 0) - (b.coveragePct ?? 0));
  const pct = s.coveragePct ?? 0;
  const below = sorted.filter((x) => (x.coveragePct ?? 0) < pct).length;
  const pctRank = sorted.length ? Math.round((below / sorted.length) * 100) : 0;
  const median = model.summary.medianCoverage;
  const diff = pct - (median ?? 0);
  const vs =
    diff > 0.5
      ? `${diff.toFixed(1)} pp above cohort median`
      : diff < -0.5
        ? `${Math.abs(diff).toFixed(1)} pp below cohort median`
        : "near cohort median";
  return `${vs} · higher than ${pctRank}% of SLRs`;
}

function refYearDistribution(refs) {
  const counts = {};
  for (const r of refs) {
    const y = r.year;
    if (y == null || y === "") continue;
    counts[y] = (counts[y] || 0) + 1;
  }
  const entries = Object.entries(counts)
    .map(([y, n]) => ({ y: Number(y), n }))
    .sort((a, b) => a.y - b.y);
  const max = Math.max(1, ...entries.map((e) => e.n));
  return { entries, max };
}

function topVenues(refs, limit = 5) {
  const counts = {};
  for (const r of refs) {
    const v = (r.venue || "").trim();
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([venue, n]) => ({ venue, n }));
}

function yearBarsHtml(refs) {
  const { entries, max } = refYearDistribution(refs);
  if (!entries.length) return `<p class="empty">No year metadata on references.</p>`;
  return `<div class="year-bars">${entries
    .map(
      (e) => `
    <div class="year-bar-row">
      <span>${e.y}</span>
      <div class="year-bar-track"><div class="year-bar-fill" style="width:${(e.n / max) * 100}%"></div></div>
      <span>${e.n}</span>
    </div>`
    )
    .join("")}</div>`;
}

function setLoading(msg) {
  $("#load-state").textContent = msg;
  $("#load-state").hidden = false;
  $("#app-root").hidden = true;
}

function setReady() {
  $("#load-state").hidden = true;
  $("#app-root").hidden = false;
}

function setError(err) {
  const el = $("#load-state");
  el.hidden = false;
  const msg = err?.message || String(err);
  el.innerHTML = `<p class="error">${esc(msg)}</p><p class="hint">Run from repo root: <code>python tools/explorer/serve.py</code></p><p class="hint">Open DevTools → Console for details.</p>`;
  console.error("Explorer failed:", err);
}

async function init() {
  setLoading("Loading pipeline data…");
  try {
    explorerBase = await loadExplorerBase((msg) => setLoading(msg));
    model = buildModel(explorerBase, settings);
    setReady();
    bindNav();
    bindSettings();
    bindTopMode();
    loadMethodsTab();
    requestAnimationFrame(() => {
      try {
        bootstrapUi();
      } catch (e) {
        setError(e);
      }
    });
  } catch (e) {
    setError(e);
  }
}

function readSettingsFromUi() {
  return {
    benchmarkSize: Number($("#setting-benchmark")?.value) || 50,
    cohort: $("#setting-cohort")?.value || "all",
    topPass: $("#setting-top-pass")?.value || "all",
  };
}

function applySettings() {
  settings = readSettingsFromUi();
  model = buildModel(explorerBase, settings);
  updateSettingsChrome();
  refreshAllViews();
}

function updateSettingsChrome() {
  const sub = $("#app-subtitle");
  if (sub) sub.textContent = model.settingsLabel;
  const hint = $("#settings-hint");
  if (hint) {
    const m = model.meta?.primary;
    hint.textContent = m
      ? `Pool ${m.pool_size} papers · ${m.established_selected}+${m.recent_selected} selected · SS citations`
      : "Live coverage from references + benchmark JSON";
  }
  const benchLabel = model.summary.benchmarkSize === 100 ? "top-100" : "top-50";
  const el = $("#consensus-top-only-label");
  if (el) el.textContent = `In current benchmark (${benchLabel}) only`;
}

function bindSettings() {
  ["setting-benchmark", "setting-cohort", "setting-top-pass"].forEach((id) => {
    $("#" + id)?.addEventListener("change", () => applySettings());
  });
}

function bindTopMode() {
  document.querySelectorAll("[data-top-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      topMode = btn.dataset.topMode;
      document.querySelectorAll("[data-top-mode]").forEach((b) =>
        b.classList.toggle("active", b.dataset.topMode === topMode)
      );
      updateTopListVisibility();
      if (topMode === "benchmark") {
        renderTopList($("#top-search")?.value || "");
        if (selectedTopKey) selectTop(selectedTopKey);
        else showTopEmpty();
      } else {
        renderConsensusList($("#top-search")?.value || "");
        if (selectedConsensusKey) selectConsensus(selectedConsensusKey);
        else renderConsensusOverview();
      }
    });
  });
}

function updateTopListVisibility() {
  const isConsensus = topMode === "consensus";
  $("#top-list").hidden = isConsensus;
  $("#consensus-list").hidden = !isConsensus;
  $("#consensus-filter-wrap").hidden = !isConsensus;
}

function showTopEmpty() {
  $("#top-detail").innerHTML = `<p class="empty">Select a paper from the list.</p>`;
}

async function loadMethodsTab() {
  const el = $("#methods-content");
  if (!el) return;
  try {
    const res = await fetch(DATA_PATHS.methodsDoc);
    if (!res.ok) throw new Error(res.statusText);
    const md = await res.text();
    el.innerHTML = renderMethodsHtml(md);
  } catch (e) {
    el.innerHTML = `<p class="error">Could not load methods doc: ${esc(e.message)}</p>`;
  }
}

function refreshAllViews() {
  renderOverview();
  renderSlrList($("#slr-search")?.value || "");
  if (topMode === "benchmark") {
    renderTopList($("#top-search")?.value || "");
  } else {
    renderConsensusList($("#top-search")?.value || "");
  }
  if (selectedSlrKey) selectSlr(selectedSlrKey);
  if (topMode === "benchmark" && selectedTopKey) selectTop(selectedTopKey);
  else if (topMode === "consensus" && selectedConsensusKey) selectConsensus(selectedConsensusKey);
  else if (topMode === "consensus") renderConsensusOverview();
}

let overviewLayoutObserver = null;

function bindOverviewLayoutResize() {
  const grid = document.querySelector(".overview-grid");
  if (!grid || overviewLayoutObserver) return;
  const bump = () => {
    if (activeView !== "overview") return;
    resizeOverviewCharts();
  };
  overviewLayoutObserver = new ResizeObserver(() => requestAnimationFrame(bump));
  overviewLayoutObserver.observe(grid);
  grid.querySelectorAll(".chart-body").forEach((el) => overviewLayoutObserver.observe(el));
  window.addEventListener("resize", bump);
}

function bootstrapUi() {
  updateSettingsChrome();
  updateTopListVisibility();
  bindOverviewLayoutResize();
  renderOverview();
  renderSlrList();
  renderTopList();
  renderConsensusList();
  $("#slr-detail").innerHTML = `<p class="empty">Select an SLR from the list.</p>`;
  showTopEmpty();
}

function bindNav() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  document.querySelectorAll("[data-goto]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.goto));
  });
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view-panel").forEach((p) => p.classList.toggle("active", p.id === `view-${view}`));
  if (view === "overview") {
    requestAnimationFrame(() => {
      renderOverview();
      resizeOverviewCharts();
    });
  } else if (view === "slrs" && selectedSlrKey) {
    requestAnimationFrame(() => selectSlr(selectedSlrKey));
  } else if (view === "top") {
    requestAnimationFrame(() => {
      if (topMode === "benchmark" && selectedTopKey) selectTop(selectedTopKey);
      else if (topMode === "consensus" && selectedConsensusKey) selectConsensus(selectedConsensusKey);
      else if (topMode === "consensus") renderConsensusOverview();
    });
  } else if (view === "methods") {
    loadMethodsTab();
  }
}

function passBadge(pass) {
  if (!pass || pass === "backfill") return "";
  const cls = pass === "established" ? "pass-established" : pass === "recent" ? "pass-recent" : "pass-muted";
  return `<span class="pass-badge ${cls}">${esc(pass)}</span>`;
}

function shortSlrTitle(s) {
  const title = s.slr.title || s.key;
  return title.length > 52 ? `${title.slice(0, 52)}…` : title;
}

function renderLeaderList(containerId, slrs) {
  const el = $(containerId);
  if (!el) return;
  if (!slrs.length) {
    el.innerHTML = `<p class="empty">None</p>`;
    return;
  }
  el.innerHTML = slrs
    .map(
      (s) => `
    <button type="button" class="leader-item" data-slr-key="${attrKey(s.key)}" title="${attrKey(s.slr.title || s.key)}">
      <span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span>
      <span class="leader-text">
        <span class="leader-year">${fmtYear(s.slr.year)}</span>
        <span class="leader-title">${esc(shortSlrTitle(s))}</span>
      </span>
    </button>`
    )
    .join("");
  el.querySelectorAll(".leader-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectSlr(keyFrom(btn, "slrKey"));
      switchView("slrs");
    });
  });
}

function renderOverviewHero(summary, slrs) {
  const headline = $("#overview-hero-headline");
  const sub = $("#overview-hero-sub");
  if (!headline) return;
  const n = summary.slrCount || 0;
  const zero = summary.zeroCoverage ?? 0;
  const zeroPct = n ? Math.round((zero / n) * 100) : 0;
  const benchLabel = summary.benchmarkSize === 100 ? "top-100" : "top-50";
  const cohortNote =
    summary.cohort === "all"
      ? ""
      : ` · ${summary.cohort === "2015-2019" ? "2015–2019" : "2020+"} cohort filter`;
  const below10 = slrs.filter((s) => (s.coveragePct ?? 0) < 10).length;
  const below10Pct = n ? Math.round((below10 / n) * 100) : 0;

  headline.innerHTML =
    `<strong>${zero}</strong> of <strong>${n}</strong> SLRs (<strong>${zeroPct}%</strong>) cite none of the ${benchLabel} benchmark.`;
  if (sub) {
    sub.textContent = `Median ${fmtPct(summary.medianCoverage)} · mean ${fmtPct(summary.meanCoverage)}${cohortNote}.` +
      (below10Pct >= 50 ? ` ${below10} of ${n} (${below10Pct}%) sit below 10% coverage.` : "");
  }
}

function renderOverview() {
  const { summary, slrs, topCited } = model;
  renderOverviewHero(summary, slrs);

  $("#kpi-slrs").textContent =
    summary.cohort === "all" ? summary.slrCount : `${summary.slrCount} / ${summary.slrCountAll}`;
  const slrsSub = $("#kpi-slrs-sub");
  if (slrsSub) {
    const missingRefs = summary.slrCount - summary.withRefs;
    slrsSub.textContent =
      missingRefs > 0 ? `${summary.withRefs} with refs · ${missingRefs} without` : `${summary.withRefs} with reference lists`;
  }
  $("#kpi-top").textContent = summary.benchmarkSize;
  $("#kpi-mean").textContent = fmtPct(summary.meanCoverage);
  $("#kpi-median").textContent = fmtPct(summary.medianCoverage);
  $("#kpi-zero").textContent = summary.zeroCoverage;
  const zeroSub = $("#kpi-zero-sub");
  if (zeroSub && summary.slrCount) {
    zeroSub.textContent = `${Math.round((summary.zeroCoverage / summary.slrCount) * 100)}% of cohort`;
  }

  const cohortBody = $("#cohort-stats-body");
  if (cohortBody && summary.cohortStats) {
    cohortBody.innerHTML = summary.cohortStats
      .map(
        (c) => `<tr>
          <td>${esc(c.label)}</td>
          <td>${c.n}</td>
          <td>${fmtPct(c.meanCoverage)}</td>
          <td>${fmtPct(c.medianCoverage)}</td>
        </tr>`
      )
      .join("");
  }

  try {
    requestAnimationFrame(() => {
      const covCanvas = $("#chart-coverage");
      const topCanvas = $("#chart-top-cited");
      if (covCanvas) renderCoverageHistogram(covCanvas, slrs);
      if (topCanvas) renderTopCitedBar(topCanvas, topCited, 10);
      resizeOverviewCharts();
    });
  } catch (e) {
    console.warn("Overview charts skipped:", e);
  }

  const sorted = [...slrs].sort((a, b) => (b.coveragePct ?? 0) - (a.coveragePct ?? 0));
  renderLeaderList("#overview-top-slrs", sorted.slice(0, 5));
  renderLeaderList("#overview-bottom-slrs", sorted.slice(-5).reverse());
}

function renderSlrList(filter = "") {
  const q = filter.trim().toLowerCase();
  const items = model.slrs.filter((s) => {
    if (!q) return true;
    const t = (s.slr.title || "").toLowerCase();
    const k = (s.key || "").toLowerCase();
    return t.includes(q) || k.includes(q);
  });
  const el = $("#slr-list");
  el.innerHTML = items
    .map(
      (s) => `
    <button type="button" class="list-item ${s.key === selectedSlrKey ? "selected" : ""}" data-key="${attrKey(s.key)}">
      <span class="list-item-title">${esc(s.slr.title?.slice(0, 72) || s.key)}${(s.slr.title?.length || 0) > 72 ? "…" : ""}</span>
      <span class="list-item-meta">${fmtYear(s.slr.year)} · ${s.refCount} refs · ${s.eligibleHits.length}H/${s.eligibleMisses.length}M · <span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span></span>
    </button>`
    )
    .join("");
  el.querySelectorAll(".list-item").forEach((btn) => {
    btn.addEventListener("click", () => selectSlr(btn.dataset.key));
  });
}

function renderTopList(filter = "") {
  const q = filter.trim().toLowerCase();
  const items = model.topPapers.filter((t) => {
    if (!q) return true;
    const title = (t.paper.title || "").toLowerCase();
    return title.includes(q) || String(t.paper._rank).includes(q);
  });
  const el = $("#top-list");
  el.innerHTML = items
    .map(
      (t) => `
    <button type="button" class="list-item ${t.key === selectedTopKey ? "selected" : ""}" data-key="${attrKey(t.key)}">
      <span class="list-item-rank">#${t.paper._rank ?? "?"}</span>
      ${passBadge(t.paper._pass)}
      <span class="list-item-title">${esc(t.paper.title?.slice(0, 64) || t.key)}${(t.paper.title?.length || 0) > 64 ? "…" : ""}</span>
      <span class="list-item-meta">${fmtYear(t.paper.year)} · ${t.paper.citationCount ?? 0} cites · ${t.citingCount}/${t.eligibleSlrCount} SLRs</span>
    </button>`
    )
    .join("");
  el.querySelectorAll(".list-item").forEach((btn) => {
    btn.addEventListener("click", () => selectTop(keyFrom(btn, "key")));
  });
}

function selectSlr(key) {
  if (!key) return;
  selectedSlrKey = key;
  slrDetailTab = slrDetailTab || "summary";
  renderSlrList($("#slr-search").value);
  const s = model.slrs.find((x) => x.key === key);
  if (!s) {
    console.warn("SLR not found for key:", key);
    return;
  }
  renderSlrDetail(s);
}

function selectTop(key) {
  if (!key) return;
  selectedTopKey = key;
  topDetailTab = topDetailTab || "summary";
  renderTopList($("#top-search").value);
  const t = model.topPapers.find((x) => x.key === key);
  if (!t) {
    console.warn("Top paper not found for key:", key);
    return;
  }
  renderTopDetail(t);
}

function detailTabsHtml(tabs, active) {
  return `
    <div class="detail-tabs">
      ${tabs
        .map((t) => {
          const countHtml = t.count != null ? `<span class="tab-count">${t.count}</span>` : "";
          return `<button type="button" class="detail-tab ${t.id === active ? "active" : ""}" data-tab="${t.id}">${esc(t.label)}${countHtml}</button>`;
        })
        .join("")}
    </div>`;
}

function bindDetailTabs(panel, tabs, onSelect) {
  panel.querySelectorAll(".detail-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      panel.querySelectorAll(".detail-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      onSelect(tab.dataset.tab);
    });
  });
}

function renderSlrDetail(s) {
  const panel = $("#slr-detail");
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "references", label: "References", count: s.refs.length },
    { id: "hits", label: "Hits", count: s.eligibleHits.length },
    { id: "misses", label: "Misses", count: s.eligibleMisses.length },
    { id: "compare", label: "Compare" },
  ];

  panel.innerHTML = `
    <header class="detail-header">
      <h2>${esc(s.slr.title)}</h2>
      <p class="detail-sub">${esc(s.key)}</p>
      <div class="detail-meta">
        <span>${fmtYear(s.slr.year)}</span>
        <span>${esc(s.slr.venue || "—")}</span>
        <span class="tag">${esc(s.slr._classification_type || "slr")}</span>
      </div>
    </header>
    ${detailTabsHtml(tabs, slrDetailTab)}
    <div class="detail-body" id="slr-tab-body"></div>
  `;

  bindDetailTabs(panel, tabs, (tab) => {
    slrDetailTab = tab;
    renderSlrTabContent(s, tab);
  });
  renderSlrTabContent(s, slrDetailTab);
}

function renderSlrTabContent(s, tab) {
  const body = $("#slr-tab-body");
  if (!body) return;

  if (tab === "summary") {
    const venues = topVenues(s.refs);
    body.innerHTML = `
      <div class="summary-headline">
        <div class="coverage-big"><span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span> benchmark coverage</div>
        <p class="coverage-context">${esc(slrCohortContext(s))}</p>
      </div>
      <div class="stat-grid compact">
        <div class="stat-card"><span class="stat-label">References</span><span class="stat-value">${s.refCount}</span></div>
        <div class="stat-card"><span class="stat-label">Eligible top-cited</span><span class="stat-value">${s.eligible.length}</span></div>
        <div class="stat-card"><span class="stat-label">Hits</span><span class="stat-value stat-hit">${s.eligibleHits.length}</span></div>
        <div class="stat-card"><span class="stat-label">Misses</span><span class="stat-value stat-miss">${s.eligibleMisses.length}</span></div>
      </div>
      <div class="summary-extras">
        <section>
          <h3>References by year</h3>
          ${yearBarsHtml(s.refs)}
        </section>
        <section>
          <h3>Top venues cited</h3>
          ${
            venues.length
              ? `<ul class="venue-list">${venues.map((v) => `<li>${esc(v.venue)} <span class="muted">(${v.n})</span></li>`).join("")}</ul>`
              : `<p class="empty">No venue metadata.</p>`
          }
        </section>
      </div>`;
    return;
  }

  if (tab === "compare") {
    renderSlrCompareTab(body, s);
    return;
  }

  const topHitKeys = new Set(s.eligibleHits.map((p) => p._paper_key));
  const topMissKeys = new Set(s.eligibleMisses.map((p) => p._paper_key));
  let rows = s.refs;
  if (tab === "hits") rows = s.eligibleHits;
  else if (tab === "misses") rows = s.eligibleMisses;

  body.innerHTML = `<div id="slr-ref-table-wrap"></div>`;
  renderRefTable("#slr-ref-table-wrap", rows, topHitKeys, topMissKeys);
}

function renderRefTable(wrapSel, rows, topHitKeys, topMissKeys) {
  const wrap = $(wrapSel);
  if (!wrap) return;
  if (!rows.length) {
    wrap.innerHTML = `<p class="empty">No items in this view.</p>`;
    return;
  }

  let sortKey = "title";
  let sortDir = 1;
  let filterQ = "";

  function benchmarkCell(pk, topPaper, isHit, isMiss) {
    if (!topPaper) return `<span class="muted">—</span>`;
    const rank = topPaper._rank;
    if (isHit) return `<span class="badge badge-hit" title="Cited">#${rank} ✓</span>`;
    if (isMiss) return `<span class="badge badge-miss" title="Eligible, not cited">#${rank} ✗</span>`;
    return `<span class="badge badge-benchmark">#${rank}</span>`;
  }

  function sortedFiltered() {
    const q = filterQ.trim().toLowerCase();
    let list = rows;
    if (q) {
      list = list.filter((r) => {
        const t = (r.title || "").toLowerCase();
        const v = (r.venue || "").toLowerCase();
        const pk = (r.paper_key || r._paper_key || "").toLowerCase();
        return t.includes(q) || v.includes(q) || pk.includes(q);
      });
    }
    list = [...list].sort((a, b) => {
      let av;
      let bv;
      if (sortKey === "year") {
        av = a.year ?? -1;
        bv = b.year ?? -1;
      } else if (sortKey === "citations") {
        av = a.citationCount ?? -1;
        bv = b.citationCount ?? -1;
      } else {
        av = (a.title || "").toLowerCase();
        bv = (b.title || "").toLowerCase();
      }
      if (av < bv) return -sortDir;
      if (av > bv) return sortDir;
      return 0;
    });
    return list;
  }

  function paint() {
    const list = sortedFiltered();
    const tbody = wrap.querySelector("tbody");
    if (!tbody) return;
    if (!list.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty">No references match your search.</td></tr>`;
      return;
    }
    tbody.innerHTML = list
      .map((r) => {
        const pk = r.paper_key || r._paper_key;
        const topPaper = model.topByKey.get(pk);
        const isHit = topHitKeys.has(pk);
        const isMiss = topMissKeys.has(pk);
        let rowClass = "";
        if (isHit) rowClass = "row-hit";
        else if (isMiss) rowClass = "row-miss-top";
        const topAttr = topPaper ? ` data-top-key="${attrKey(pk)}"` : "";
        const clickClass = topPaper ? " clickable-row" : "";
        return `<tr class="${rowClass}${clickClass}"${topAttr}>
          <td class="col-benchmark">${benchmarkCell(pk, topPaper, isHit, isMiss)}</td>
          <td class="title-cell col-title">${esc(r.title)}</td>
          <td class="col-year">${fmtYear(r.year)}</td>
          <td class="col-cites">${r.citationCount ?? "—"}</td>
          <td class="col-venue">${esc(r.venue || "—")}</td>
          <td class="col-key">${formatKeyLink(pk)}</td>
        </tr>`;
      })
      .join("");
  }

  wrap.innerHTML = `
    <div class="table-toolbar">
      <input type="search" class="search-input ref-table-search" placeholder="Filter references…" />
      <span class="hint ref-table-count"></span>
    </div>
    <div class="table-wrap">
      <table class="data-table ref-table">
        <colgroup>
          <col class="col-benchmark" />
          <col class="col-title" />
          <col class="col-year" />
          <col class="col-cites" />
          <col class="col-venue" />
          <col class="col-key" />
        </colgroup>
        <thead><tr>
          <th data-sort="benchmark" class="col-benchmark">Benchmark</th>
          <th data-sort="title" class="col-title sorted-asc">Title</th>
          <th data-sort="year" class="col-year">Year</th>
          <th data-sort="citations" class="col-cites">Cites</th>
          <th class="col-venue">Venue</th>
          <th class="col-key">Link</th>
        </tr></thead>
        <tbody></tbody>
      </table>
    </div>`;

  const updateCount = () => {
    const el = wrap.querySelector(".ref-table-count");
    if (el) el.textContent = `${sortedFiltered().length} of ${rows.length} references`;
  };

  paint();
  updateCount();

  wrap.querySelector(".ref-table-search")?.addEventListener("input", (e) => {
    filterQ = e.target.value;
    paint();
    updateCount();
  });

  wrap.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const key = th.dataset.sort;
      if (key === "benchmark") return;
      if (sortKey === key) sortDir *= -1;
      else {
        sortKey = key;
        sortDir = key === "title" ? 1 : -1;
      }
      wrap.querySelectorAll("th[data-sort]").forEach((h) => {
        h.classList.remove("sorted-asc", "sorted-desc");
      });
      th.classList.add(sortDir === 1 ? "sorted-asc" : "sorted-desc");
      paint();
    });
  });

  wrap.addEventListener("click", (e) => {
    if (e.target.closest("a.key-link")) return;
    const tr = e.target.closest("tr[data-top-key]");
    const topKey = keyFrom(tr, "topKey");
    if (topKey) {
      topMode = "benchmark";
      document.querySelectorAll("[data-top-mode]").forEach((b) =>
        b.classList.toggle("active", b.dataset.topMode === "benchmark")
      );
      updateTopListVisibility();
      selectTop(topKey);
      switchView("top");
    }
  });
}

function overlapVizHtml(detail) {
  const u = detail.union || 1;
  const wA = (detail.onlyA.length / u) * 100;
  const wS = (detail.sharedCount / u) * 100;
  const wB = (detail.onlyB.length / u) * 100;
  return `
    <div class="overlap-viz">
      <div class="overlap-bar" title="Proportions of unique references (union = ${u})">
        <div class="overlap-seg-only-a" style="width:${wA}%"></div>
        <div class="overlap-seg-shared" style="width:${wS}%"></div>
        <div class="overlap-seg-only-b" style="width:${wB}%"></div>
      </div>
      <div class="overlap-legend">
        <span class="legend-only-a">Only current (${detail.onlyA.length})</span>
        <span class="legend-shared">Shared (${detail.sharedCount})</span>
        <span class="legend-only-b">Only other (${detail.onlyB.length})</span>
      </div>
    </div>`;
}

function renderCompareRefRows(rows) {
  if (!rows.length) return `<p class="empty">No items in this view.</p>`;
  return `
    <div class="table-wrap">
      <table class="data-table">
        <colgroup>
          <col class="col-benchmark" /><col class="col-title" /><col class="col-year" />
          <col class="col-cites" /><col class="col-key" />
        </colgroup>
        <thead><tr>
          <th>Benchmark</th><th>Title</th><th>Year</th><th>Cites</th><th>Link</th>
        </tr></thead>
        <tbody>
          ${rows
            .map((r) => {
              const pk = r.paper_key;
              const topPaper = model.topByKey.get(pk);
              const badge = topPaper ? `<span class="badge badge-benchmark">#${topPaper._rank}</span>` : `<span class="muted">—</span>`;
              return `<tr>
                <td>${badge}</td>
                <td class="title-cell">${esc(r.title)}</td>
                <td>${fmtYear(r.year)}</td>
                <td class="col-cites">${r.citationCount ?? "—"}</td>
                <td>${formatKeyLink(pk)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>
    </div>`;
}

function renderSlrCompareTab(body, currentSlr) {
  const withRefs = model.slrs.filter((s) => s.refCount > 0);
  compareSlrA = currentSlr.key;
  if (!compareSlrB || compareSlrB === compareSlrA) {
    compareSlrB = withRefs.find((s) => s.key !== currentSlr.key)?.key || withRefs[0]?.key;
  }

  const optsB = withRefs
    .filter((s) => s.key !== compareSlrA)
    .map(
      (s) =>
        `<option value="${esc(s.key)}" ${s.key === compareSlrB ? "selected" : ""}>${fmtYear(s.slr.year)} · ${esc(s.slr.title?.slice(0, 56) || s.key)}${(s.slr.title?.length || 0) > 56 ? "…" : ""}</option>`
    )
    .join("");

  body.innerHTML = `
    <div class="compare-toolbar-inline">
      <label>Current SLR
        <select id="compare-slr-a" class="compare-select" disabled title="${esc(currentSlr.slr.title)}">
          <option>${fmtYear(currentSlr.slr.year)} · ${esc(currentSlr.slr.title?.slice(0, 56) || currentSlr.key)}…</option>
        </select>
      </label>
      <button type="button" id="compare-swap" class="btn-secondary btn-icon" title="Swap SLRs">↔</button>
      <label>Compare with
        <select id="compare-slr-b" class="compare-select">${optsB}</select>
      </label>
    </div>
    <div id="compare-ref-table-wrap"></div>`;

  body.querySelector("#compare-slr-b")?.addEventListener("change", (e) => {
    compareSlrB = e.target.value;
    renderCompareTableIn(body);
  });
  body.querySelector("#compare-swap")?.addEventListener("click", () => {
    if (!compareSlrB) return;
    const prevA = compareSlrA;
    compareSlrA = compareSlrB;
    compareSlrB = prevA;
    selectSlr(compareSlrA);
    slrDetailTab = "compare";
    renderSlrDetail(model.slrs.find((s) => s.key === compareSlrA));
  });

  renderCompareTableIn(body);
}

function renderCompareTableIn(body) {
  const a = model.slrs.find((s) => s.key === compareSlrA);
  const b = model.slrs.find((s) => s.key === compareSlrB);
  const wrap = body.querySelector("#compare-ref-table-wrap");
  if (!wrap) return;

  if (!a || !b || a.key === b.key) {
    wrap.innerHTML = `<p class="empty">${!a || !b ? "Select two SLRs with reference lists." : "Choose a different SLR to compare."}</p>`;
    return;
  }

  const detail = pairwiseDetail(a, b);
  wrap.innerHTML = `
    ${overlapVizHtml(detail)}
    <div class="compare-metrics">
      <div class="stat-card stat-primary">
        <span class="stat-label">Jaccard similarity<span class="stat-hint">intersection ÷ union</span></span>
        <span class="stat-value">${(detail.jaccard * 100).toFixed(1)}%</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Overlap coefficient<span class="stat-hint">intersection ÷ min(|A|,|B|)</span></span>
        <span class="stat-value">${(detail.overlapCoef * 100).toFixed(1)}%</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Shared references</span>
        <span class="stat-value">${detail.sharedCount}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">Unique refs</span>
        <span class="stat-value" style="font-size:1rem">${detail.onlyA.length} / ${detail.onlyB.length}</span>
        <span class="stat-hint">only current / only other</span>
      </div>
    </div>
    <div class="ref-tabs" id="compare-ref-tabs">
      <button type="button" class="ref-tab active" data-tab="shared">Shared <span class="tab-count">${detail.shared.length}</span></button>
      <button type="button" class="ref-tab" data-tab="onlyA">Only current <span class="tab-count">${detail.onlyA.length}</span></button>
      <button type="button" class="ref-tab" data-tab="onlyB">Only other <span class="tab-count">${detail.onlyB.length}</span></button>
    </div>
    <div id="compare-table-inner"></div>`;

  function renderInner(rows) {
    const inner = wrap.querySelector("#compare-table-inner");
    inner.innerHTML = renderCompareRefRows(rows);
  }

  renderInner(detail.shared);
  wrap.querySelectorAll("#compare-ref-tabs .ref-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      wrap.querySelectorAll("#compare-ref-tabs .ref-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.tab;
      if (mode === "onlyA") renderInner(detail.onlyA);
      else if (mode === "onlyB") renderInner(detail.onlyB);
      else renderInner(detail.shared);
    });
  });
}

function renderTopDetail(t) {
  const p = t.paper;
  const panel = $("#top-detail");
  const citeRate = t.eligibleSlrCount ? (t.citingCount / t.eligibleSlrCount) * 100 : 0;
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "citing", label: "Citing", count: t.citing.length },
    { id: "missing", label: "Missing", count: t.missing.length },
  ];

  panel.innerHTML = `
    <header class="detail-header">
      <h2><span class="rank-pill">#${p._rank ?? "?"}</span> ${esc(p.title)}</h2>
      <p class="detail-sub mono">${esc(t.key)}</p>
      <div class="detail-meta">
        <span>${fmtYear(p.year)}</span>
        ${passBadge(p._pass)}
        <span>${esc(p.venue || "—")}</span>
        <span>${p.citationCount ?? 0} citations</span>
      </div>
    </header>
    ${detailTabsHtml(tabs, topDetailTab)}
    <div class="detail-body" id="top-tab-body"></div>
  `;

  bindDetailTabs(panel, tabs, (tab) => {
    topDetailTab = tab;
    renderTopTabContent(t, citeRate, tab);
  });
  renderTopTabContent(t, citeRate, topDetailTab);
}

function renderTopTabContent(t, citeRate, tab) {
  const body = $("#top-tab-body");
  if (!body) return;

  if (tab === "summary") {
    body.innerHTML = `
      <div class="stat-grid compact">
        <div class="stat-card"><span class="stat-label">Eligible SLRs</span><span class="stat-value">${t.eligibleSlrCount}</span></div>
        <div class="stat-card"><span class="stat-label">Citing (hit)</span><span class="stat-value stat-hit">${t.citingCount}</span></div>
        <div class="stat-card"><span class="stat-label">Missing</span><span class="stat-value stat-miss">${t.missCount}</span></div>
        <div class="stat-card wide"><span class="stat-label">Citation rate</span><span class="stat-value">${citeRate.toFixed(1)}%</span></div>
      </div>`;
    return;
  }

  const slrs = tab === "citing" ? t.citing : t.missing;
  body.innerHTML = slrMiniTable(slrs);
  bindSlrMiniTableClicks(body);
}

function slrMiniTable(slrs) {
  if (!slrs.length) return `<p class="empty">None</p>`;
  return `
    <table class="data-table compact">
      <thead><tr><th>Year</th><th>SLR</th><th>Coverage</th><th>Refs</th></tr></thead>
      <tbody>
        ${slrs
          .map(
            (s) => `<tr class="clickable-row" data-slr-key="${attrKey(s.key)}">
              <td>${fmtYear(s.slr.year)}</td>
              <td class="title-cell">${esc(s.slr.title)}</td>
              <td><span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span></td>
              <td>${s.refCount}</td>
            </tr>`
          )
          .join("")}
      </tbody>
    </table>`;
}

function bindSlrMiniTableClicks(container) {
  container.querySelectorAll("[data-slr-key].clickable-row").forEach((row) => {
    row.addEventListener("click", () => {
      selectSlr(keyFrom(row, "slrKey"));
      switchView("slrs");
    });
  });
}

function renderConsensusOverview() {
  const panel = $("#top-detail");
  const { consensusPapers, summary } = model;
  panel.innerHTML = `
    <header class="detail-header">
      <h2>SLR consensus bibliography</h2>
      <p class="detail-sub">Papers ranked by how many SLRs cite them in their reference lists.</p>
    </header>
    <div class="detail-body">
      <div class="stat-grid compact">
        <div class="stat-card"><span class="stat-label">Unique papers cited</span><span class="stat-value">${summary.uniqueCitedPapers}</span></div>
        <div class="stat-card"><span class="stat-label">Max consensus</span><span class="stat-value">${summary.maxConsensusCites}/${summary.slrCount}</span></div>
        <div class="stat-card"><span class="stat-label">In benchmark</span><span class="stat-value">${consensusPapers.filter((p) => p.inTopBenchmark).length}</span></div>
      </div>
      <div class="chart-card-inline"><canvas id="chart-consensus"></canvas></div>
      <p class="hint">Blue = in current top-cited benchmark. Grey = cited by SLRs but outside benchmark.</p>
    </div>
  `;
  try {
    renderConsensusBar($("#chart-consensus"), consensusPapers, 20, summary.slrCount);
  } catch (e) {
    console.warn("Consensus chart skipped:", e);
  }
}

function renderConsensusList(filter = "") {
  const q = filter.trim().toLowerCase();
  const topOnly = $("#consensus-top-only")?.checked;
  const items = model.consensusPapers.filter((p) => {
    if (topOnly && !p.inTopBenchmark) return false;
    if (!q) return true;
    const title = (p.ref.title || "").toLowerCase();
    return title.includes(q) || String(p.citingCount).includes(q) || (p.key || "").toLowerCase().includes(q);
  });
  const el = $("#consensus-list");
  el.innerHTML = items
    .map(
      (p) => `
    <button type="button" class="list-item ${p.key === selectedConsensusKey ? "selected" : ""}" data-key="${attrKey(p.key)}">
      <span class="list-item-rank">${p.citingCount}/${model.summary.slrCount}</span>
      <span class="list-item-title">${esc(p.ref.title?.slice(0, 64) || p.key)}${(p.ref.title?.length || 0) > 64 ? "…" : ""}</span>
      <span class="list-item-meta">${fmtYear(p.ref.year)} · ${p.ref.citationCount ?? "—"} SS cites${p.inTopBenchmark ? ` · #${p.topRank}` : ""}</span>
    </button>`
    )
    .join("");
  el.querySelectorAll(".list-item").forEach((btn) => {
    btn.addEventListener("click", () => selectConsensus(keyFrom(btn, "key")));
  });
}

function selectConsensus(key) {
  if (!key) return;
  selectedConsensusKey = key;
  renderConsensusList($("#top-search").value);
  const p = model.consensusPapers.find((x) => x.key === key);
  if (!p) {
    console.warn("Consensus paper not found for key:", key);
    return;
  }
  renderConsensusDetail(p);
}

function renderConsensusDetail(p) {
  const panel = $("#top-detail");
  const rate = model.summary.slrCount ? (p.citingCount / model.summary.slrCount) * 100 : 0;
  panel.innerHTML = `
    <header class="detail-header">
      <h2><span class="rank-pill">${p.citingCount}/${model.summary.slrCount}</span> ${esc(p.ref.title)}</h2>
      <p class="detail-sub mono">${esc(p.key)}</p>
      <div class="detail-meta">
        <span>${fmtYear(p.ref.year)}</span>
        <span>${esc(p.ref.venue || "—")}</span>
        <span>${p.ref.citationCount ?? "—"} SS citations</span>
        ${p.inTopBenchmark ? `<span class="tag">Benchmark #${p.topRank}</span>` : `<span class="tag tag-muted">Outside benchmark</span>`}
      </div>
    </header>
    <div class="detail-body">
      <div class="stat-grid compact">
        <div class="stat-card"><span class="stat-label">SLRs citing</span><span class="stat-value stat-hit">${p.citingCount}</span></div>
        <div class="stat-card"><span class="stat-label">SLRs not citing</span><span class="stat-value">${model.summary.slrCount - p.citingCount}</span></div>
        <div class="stat-card wide"><span class="stat-label">Consensus rate</span><span class="stat-value">${rate.toFixed(1)}% of SLRs</span></div>
      </div>
      <h3>SLRs that cite this paper (${p.citingSlrs.length})</h3>
      ${slrMiniTable(p.citingSlrs)}
    </div>
  `;
  bindSlrMiniTableClicks(panel);
}

$("#slr-search")?.addEventListener("input", (e) => renderSlrList(e.target.value));
$("#top-search")?.addEventListener("input", (e) => {
  if (topMode === "benchmark") renderTopList(e.target.value);
  else renderConsensusList(e.target.value);
});
$("#consensus-top-only")?.addEventListener("change", () => renderConsensusList($("#top-search").value));

window.addEventListener("beforeunload", () => {
  destroyCharts();
});

init().catch((e) => setError(e));
