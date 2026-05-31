import { loadExplorerData } from "./data.js";
import {
  destroyCharts,
  renderCoverageHistogram,
  renderTopCitedBar,
  renderSlrCoverageGauge,
} from "./charts.js";

let model = null;
let slrGaugeChart = null;
let activeView = "overview";
let selectedSlrKey = null;
let selectedTopKey = null;

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

function encKey(key) {
  return encodeURIComponent(key ?? "");
}

function coverageClass(pct) {
  if (pct == null) return "badge-muted";
  if (pct === 0) return "badge-zero";
  if (pct < 15) return "badge-low";
  if (pct < 30) return "badge-mid";
  return "badge-high";
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
    model = await loadExplorerData((msg) => setLoading(msg));
    setReady();
    bindNav();
    // Defer charts/DOM work so the browser can paint past the loading screen first.
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

function bootstrapUi() {
  renderOverview();
  renderSlrList();
  renderTopList();
  $("#slr-detail").innerHTML = `<p class="empty">Select an SLR from the list.</p>`;
  $("#top-detail").innerHTML = `<p class="empty">Select a top-cited paper from the list.</p>`;
}

function bindNav() {
  document.querySelectorAll("[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
}

function switchView(view) {
  activeView = view;
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  document.querySelectorAll(".view-panel").forEach((p) => p.classList.toggle("active", p.id === `view-${view}`));
  if (view === "overview") {
    requestAnimationFrame(() => renderOverview());
  } else if (view === "slrs" && selectedSlrKey) {
    requestAnimationFrame(() => selectSlr(selectedSlrKey));
  } else if (view === "top" && selectedTopKey) {
    requestAnimationFrame(() => selectTop(selectedTopKey));
  }
}

function renderOverview() {
  const { summary, slrs, topCited } = model;
  $("#kpi-slrs").textContent = summary.slrCount;
  $("#kpi-top").textContent = summary.topCount;
  $("#kpi-refs").textContent = summary.withRefs;
  $("#kpi-mean").textContent = fmtPct(summary.meanCoverage);
  $("#kpi-median").textContent = fmtPct(summary.medianCoverage);
  $("#kpi-zero").textContent = summary.zeroCoverage;

  try {
    renderCoverageHistogram($("#chart-coverage"), slrs);
    renderTopCitedBar($("#chart-top-cited"), topCited, 15);
  } catch (e) {
    console.warn("Overview charts skipped:", e);
  }

  const tbody = $("#overview-slrs-body");
  tbody.innerHTML = slrs
    .map(
      (s) => `
    <tr data-slr-key="${encKey(s.key)}" class="clickable-row">
      <td>${fmtYear(s.slr.year)}</td>
      <td class="title-cell">${esc(s.slr.title)}</td>
      <td>${s.refCount}</td>
      <td>${s.eligible.length}</td>
      <td>${s.eligibleHits.length}</td>
      <td><span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span></td>
    </tr>`
    )
    .join("");
  tbody.querySelectorAll("tr").forEach((tr) => {
    tr.addEventListener("click", () => {
      selectSlr(tr.dataset.slrKey);
      switchView("slrs");
    });
  });
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
    <button type="button" class="list-item ${s.key === selectedSlrKey ? "selected" : ""}" data-key="${encKey(s.key)}">
      <span class="list-item-title">${esc(s.slr.title?.slice(0, 72) || s.key)}${(s.slr.title?.length || 0) > 72 ? "…" : ""}</span>
      <span class="list-item-meta">${fmtYear(s.slr.year)} · ${s.refCount} refs · <span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span></span>
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
    <button type="button" class="list-item ${t.key === selectedTopKey ? "selected" : ""}" data-key="${encKey(t.key)}">
      <span class="list-item-rank">#${t.paper._rank ?? "?"}</span>
      <span class="list-item-title">${esc(t.paper.title?.slice(0, 64) || t.key)}${(t.paper.title?.length || 0) > 64 ? "…" : ""}</span>
      <span class="list-item-meta">${t.paper.citationCount ?? 0} cites · cited by ${t.citingCount}/${t.eligibleSlrCount} SLRs</span>
    </button>`
    )
    .join("");
  el.querySelectorAll(".list-item").forEach((btn) => {
    btn.addEventListener("click", () => selectTop(btn.dataset.key));
  });
}

function selectSlr(key) {
  selectedSlrKey = key;
  renderSlrList($("#slr-search").value);
  const s = model.slrs.find((x) => x.key === key);
  if (!s) return;
  if (activeView === "slrs") {
    renderSlrDetail(s);
  }
}

function selectTop(key) {
  selectedTopKey = key;
  renderTopList($("#top-search").value);
  const t = model.topPapers.find((x) => x.key === key);
  if (!t) return;
  if (activeView === "top") {
    renderTopDetail(t);
  }
}

function renderSlrDetail(s) {
  const panel = $("#slr-detail");
  const ov = s.overlap;
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
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">References (unique keys)</span><span class="stat-value">${s.refCount}</span></div>
      <div class="stat-card"><span class="stat-label">Eligible top-cited</span><span class="stat-value">${s.eligible.length}</span></div>
      <div class="stat-card"><span class="stat-label">Hits</span><span class="stat-value stat-hit">${s.eligibleHits.length}</span></div>
      <div class="stat-card"><span class="stat-label">Misses</span><span class="stat-value stat-miss">${s.eligibleMisses.length}</span></div>
      <div class="stat-card wide"><span class="stat-label">Coverage</span><span class="stat-value"><span class="badge ${coverageClass(s.coveragePct)}">${fmtPct(s.coveragePct)}</span></span></div>
    </div>
    <div class="gauge-wrap"><canvas id="slr-gauge"></canvas></div>
    <div class="ref-tabs">
      <button type="button" class="ref-tab active" data-tab="all">All references (${s.refs.length})</button>
      <button type="button" class="ref-tab" data-tab="hits">Top-cited hits (${s.eligibleHits.length})</button>
      <button type="button" class="ref-tab" data-tab="misses">Top-cited misses (${s.eligibleMisses.length})</button>
    </div>
    <div id="slr-ref-table-wrap"></div>
  `;

  if (slrGaugeChart) {
    slrGaugeChart.destroy();
    slrGaugeChart = null;
  }
  const gaugeEl = $("#slr-gauge");
  if (gaugeEl && activeView === "slrs") {
    try {
      slrGaugeChart = renderSlrCoverageGauge(gaugeEl, s.coveragePct ?? 0);
    } catch (e) {
      console.warn("Coverage gauge skipped:", e);
    }
  }

  const topHitKeys = new Set(s.eligibleHits.map((p) => p._paper_key));
  const topMissKeys = new Set(s.eligibleMisses.map((p) => p._paper_key));

  function renderTable(rows, mode) {
    const wrap = $("#slr-ref-table-wrap");
    if (!rows.length) {
      wrap.innerHTML = `<p class="empty">No items in this view.</p>`;
      return;
    }
    wrap.innerHTML = `
      <table class="data-table">
        <thead><tr>
          <th>Top?</th><th>Title</th><th>Year</th><th>Citations</th><th>Venue</th><th>Key</th>
        </tr></thead>
        <tbody>
          ${rows
            .map((r) => {
              const pk = r.paper_key || r._paper_key;
              const topPaper = model.topByKey.get(pk);
              const isHit = topHitKeys.has(pk);
              const isMiss = topMissKeys.has(pk);
              const rank = topPaper?._rank;
              let rowClass = "";
              if (isHit) rowClass = "row-hit";
              else if (isMiss) rowClass = "row-miss-top";
              let badge = "";
              if (isHit) badge = `<span class="badge badge-high">#${rank} hit</span>`;
              else if (isMiss) badge = `<span class="badge badge-mid">#${rank} miss</span>`;
              else if (topPaper) badge = `<span class="badge badge-muted">#${rank}</span>`;
              const topAttr = topPaper ? ` data-top-key="${encKey(pk)}"` : "";
              const clickClass = topPaper ? " clickable-row" : "";
              return `<tr class="${rowClass}${clickClass}"${topAttr}>
                <td>${badge}</td>
                <td class="title-cell">${esc(r.title)}</td>
                <td>${fmtYear(r.year)}</td>
                <td>${r.citationCount ?? "—"}</td>
                <td>${esc(r.venue || "—")}</td>
                <td class="mono">${esc(pk)}</td>
              </tr>`;
            })
            .join("")}
        </tbody>
      </table>`;
  }

  renderTable(s.refs, "all");
  panel.querySelectorAll(".ref-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      panel.querySelectorAll(".ref-tab").forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");
      const mode = tab.dataset.tab;
      if (mode === "hits") renderTable(s.eligibleHits, "hits");
      else if (mode === "misses") renderTable(s.eligibleMisses, "misses");
      else renderTable(s.refs, "all");
    });
  });

  $("#slr-ref-table-wrap").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-top-key]");
    if (tr?.dataset.topKey) {
      selectTop(tr.dataset.topKey);
      switchView("top");
    }
  });
}

function renderTopDetail(t) {
  const p = t.paper;
  const panel = $("#top-detail");
  const citeRate = t.eligibleSlrCount ? (t.citingCount / t.eligibleSlrCount) * 100 : 0;
  panel.innerHTML = `
    <header class="detail-header">
      <h2><span class="rank-pill">#${p._rank ?? "?"}</span> ${esc(p.title)}</h2>
      <p class="detail-sub mono">${esc(t.key)}</p>
      <div class="detail-meta">
        <span>${fmtYear(p.year)}</span>
        <span>${esc(p.venue || "—")}</span>
        <span>${p.citationCount ?? 0} citations</span>
      </div>
    </header>
    <div class="stat-grid">
      <div class="stat-card"><span class="stat-label">SLRs where eligible</span><span class="stat-value">${t.eligibleSlrCount}</span></div>
      <div class="stat-card"><span class="stat-label">SLRs citing (hit)</span><span class="stat-value stat-hit">${t.citingCount}</span></div>
      <div class="stat-card"><span class="stat-label">SLRs missing</span><span class="stat-value stat-miss">${t.missCount}</span></div>
      <div class="stat-card wide"><span class="stat-label">Citation rate among eligible SLRs</span><span class="stat-value">${citeRate.toFixed(1)}%</span></div>
    </div>
    <div class="dual-panels">
      <section>
        <h3>SLRs that cite this paper (${t.citing.length})</h3>
        ${slrMiniTable(t.citing)}
      </section>
      <section>
        <h3>Eligible SLRs that do not cite (${t.missing.length})</h3>
        ${slrMiniTable(t.missing)}
      </section>
    </div>
  `;
}

function slrMiniTable(slrs) {
  if (!slrs.length) return `<p class="empty">None</p>`;
  return `
    <table class="data-table compact">
      <thead><tr><th>Year</th><th>SLR</th><th>Coverage</th><th>Refs</th></tr></thead>
      <tbody>
        ${slrs
          .map(
            (s) => `<tr class="clickable-row" data-slr-key="${encKey(s.key)}">
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

document.addEventListener("click", (e) => {
  const row = e.target.closest("[data-slr-key].clickable-row");
  if (row && row.closest("#top-detail")) {
    selectSlr(row.dataset.slrKey);
    switchView("slrs");
  }
});

$("#slr-search")?.addEventListener("input", (e) => renderSlrList(e.target.value));
$("#top-search")?.addEventListener("input", (e) => renderTopList(e.target.value));

window.addEventListener("beforeunload", () => {
  destroyCharts();
  if (slrGaugeChart) slrGaugeChart.destroy();
});

init().catch((e) => setError(e));
