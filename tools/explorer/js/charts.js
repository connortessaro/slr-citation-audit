/**
 * Chart.js helpers for overview and top-cited charts.
 */

const CHART_FONT = '"IBM Plex Sans", system-ui, sans-serif';
const CHART_GRID_Y = "rgba(148, 163, 184, 0.08)";
const CHART_SLATE = "rgba(100, 116, 139, 0.72)";
const CHART_SLATE_BORDER = "rgb(100, 116, 139)";

let coverageChart = null;
let topCitedChart = null;
let consensusChart = null;
let topSummaryBenchmarkChart = null;
let topSummaryConsensusChart = null;
let benchmarkRateChart = null;

function ChartLib() {
  const C = typeof globalThis !== "undefined" ? globalThis.Chart : undefined;
  if (!C) {
    throw new Error(
      "Chart.js failed to load (check network or ad blocker). Charts are optional; tables still work."
    );
  }
  return C;
}

function baseScaleOpts() {
  return {
    font: { family: CHART_FONT, size: 11 },
    color: "#64748b",
    grid: { color: CHART_GRID_Y, drawBorder: false },
    ticks: { font: { family: CHART_FONT, size: 10 } },
  };
}

function truncateLabel(title, max = 32) {
  const t = title || "Untitled";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function destroyInstance(ref) {
  if (ref) {
    ref.destroy();
    return null;
  }
  return null;
}

export function destroyCharts() {
  coverageChart = destroyInstance(coverageChart);
  topCitedChart = destroyInstance(topCitedChart);
  consensusChart = destroyInstance(consensusChart);
  topSummaryBenchmarkChart = destroyInstance(topSummaryBenchmarkChart);
  topSummaryConsensusChart = destroyInstance(topSummaryConsensusChart);
  benchmarkRateChart = destroyInstance(benchmarkRateChart);
}

function renderHorizontalBarChart(canvas, holder, { labels, data, bgColors, borderColors, xTitle, tooltipTitle }) {
  if (holder.instance) holder.instance.destroy();
  const Chart = ChartLib();
  holder.instance = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: bgColors ?? CHART_SLATE,
          borderColor: borderColors ?? CHART_SLATE_BORDER,
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 12, bottom: 8, left: 4 } },
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: tooltipTitle
          ? {
              callbacks: {
                title: tooltipTitle,
              },
            }
          : {},
      },
      scales: {
        x: {
          ...baseScaleOpts(),
          title: xTitle
            ? {
                display: true,
                text: xTitle,
                font: { family: CHART_FONT, size: 11 },
                color: "#64748b",
              }
            : { display: false },
          beginAtZero: true,
          grid: { display: true, color: CHART_GRID_Y },
        },
        y: {
          ...baseScaleOpts(),
          grid: { display: false },
          ticks: { font: { size: 9 }, autoSkip: false },
        },
      },
    },
  });
  return holder.instance;
}

export function renderCoverageHistogram(canvas, slrs) {
  const bins = Array(10).fill(0);
  for (const s of slrs) {
    if (!Number.isFinite(s.coveragePct)) continue;
    const idx = Math.min(9, Math.floor(s.coveragePct / 10));
    bins[idx]++;
  }
  const labels = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70–79", "80–89", "90–100"];
  coverageChart = destroyInstance(coverageChart);
  const Chart = ChartLib();
  coverageChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "SLRs",
          data: bins,
          backgroundColor: CHART_SLATE,
          borderColor: CHART_SLATE_BORDER,
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 8, bottom: 4, left: 4 } },
      plugins: {
        legend: { display: false },
        title: { display: false },
      },
      scales: {
        x: {
          ...baseScaleOpts(),
          title: {
            display: true,
            text: "Coverage (%)",
            font: { family: CHART_FONT, size: 11 },
            color: "#64748b",
          },
          grid: { display: false },
          ticks: { maxRotation: 0, font: { size: 9 } },
        },
        y: {
          ...baseScaleOpts(),
          title: {
            display: true,
            text: "Number of SLRs",
            font: { family: CHART_FONT, size: 11 },
            color: "#64748b",
          },
          beginAtZero: true,
          grid: { color: CHART_GRID_Y, drawBorder: false },
          ticks: { precision: 0, font: { family: CHART_FONT, size: 10 } },
        },
      },
    },
  });
}

export function renderTopCitedBar(canvas, topCited, limit = 10) {
  const slice = topCited.slice(0, limit);
  const labels = slice.map((p) => {
    const yr = p.year != null ? ` · ${p.year}` : "";
    return truncateLabel(p.title, 30) + yr;
  });
  const data = slice.map((p) => p.citationCount ?? 0);
  topCitedChart = destroyInstance(topCitedChart);
  const holder = { instance: null };
  topCitedChart = renderHorizontalBarChart(canvas, holder, {
    labels,
    data,
    xTitle: "Citations (Semantic Scholar)",
    tooltipTitle(items) {
      const i = items[0]?.dataIndex ?? 0;
      const p = slice[i];
      return p ? `#${p._rank ?? "?"} · ${p.title || ""}` : "";
    },
  });
}

export function renderTopSummaryBenchmarkBar(canvas, topCited, limit = 10) {
  const slice = topCited.slice(0, limit);
  const labels = slice.map((p) => {
    const yr = p.year != null ? ` · ${p.year}` : "";
    return truncateLabel(p.title, 28) + yr;
  });
  const data = slice.map((p) => p.citationCount ?? 0);
  topSummaryBenchmarkChart = destroyInstance(topSummaryBenchmarkChart);
  const holder = { instance: null };
  topSummaryBenchmarkChart = renderHorizontalBarChart(canvas, holder, {
    labels,
    data,
    xTitle: "SS citations",
    tooltipTitle(items) {
      const i = items[0]?.dataIndex ?? 0;
      const p = slice[i];
      return p ? `#${p._rank ?? "?"} · ${p.title || ""}` : "";
    },
  });
}

export function renderBenchmarkCitationRateBar(canvas, topPapers, limit = 10) {
  const slice = [...topPapers]
    .filter((t) => t.eligibleSlrCount > 0)
    .sort((a, b) => {
      const ra = a.citingCount / a.eligibleSlrCount;
      const rb = b.citingCount / b.eligibleSlrCount;
      return ra - rb;
    })
    .slice(0, limit);
  const labels = slice.map((t) => `#${t.paper._rank ?? "?"} · ${truncateLabel(t.paper.title, 26)}`);
  const data = slice.map((t) => (t.citingCount / t.eligibleSlrCount) * 100);
  benchmarkRateChart = destroyInstance(benchmarkRateChart);
  const holder = { instance: null };
  benchmarkRateChart = renderHorizontalBarChart(canvas, holder, {
    labels,
    data,
    bgColors: slice.map((t) =>
      t.citingCount === 0 ? "rgba(220, 38, 38, 0.55)" : "rgba(100, 116, 139, 0.72)"
    ),
    borderColors: slice.map((t) => (t.citingCount === 0 ? "rgb(220, 38, 38)" : "rgb(100, 116, 139)")),
    xTitle: "% eligible SLRs citing",
    tooltipTitle(items) {
      const i = items[0]?.dataIndex ?? 0;
      const t = slice[i];
      if (!t) return "";
      return `${t.paper.title || ""} · ${t.citingCount}/${t.eligibleSlrCount} SLRs`;
    },
  });
}

export function resizeOverviewCharts() {
  coverageChart?.resize();
  topCitedChart?.resize();
}

export function resizeTopCharts() {
  topSummaryBenchmarkChart?.resize();
  topSummaryConsensusChart?.resize();
  benchmarkRateChart?.resize();
}

export function renderConsensusBar(canvas, consensusPapers, limit = 20, slrCount = null) {
  const slice = consensusPapers.slice(0, limit);
  const labels = slice.map((p) => truncateLabel(p.ref?.title, 36));
  const data = slice.map((p) => p.citingCount);
  consensusChart = destroyInstance(consensusChart);
  const totalSlrs = slrCount ?? slice[0]?.citingSlrs?.length ?? "—";
  const Chart = ChartLib();
  consensusChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "SLRs citing",
          data,
          backgroundColor: slice.map((p) =>
            p.inTopBenchmark ? "rgba(71, 85, 105, 0.85)" : "rgba(148, 163, 184, 0.55)"
          ),
          borderColor: slice.map((p) => (p.inTopBenchmark ? "rgb(71, 85, 105)" : "rgb(148, 163, 184)")),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex ?? 0;
              return slice[i]?.ref?.title || "";
            },
            afterLabel(item) {
              const p = slice[item.dataIndex];
              if (!p) return "";
              const bits = [`${p.citingCount}/${totalSlrs} SLRs`];
              if (p.inTopBenchmark) bits.push(`benchmark rank #${p.topRank}`);
              return bits.join(" · ");
            },
          },
        },
      },
      scales: {
        x: {
          ...baseScaleOpts(),
          title: { display: false },
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
        y: {
          ...baseScaleOpts(),
          grid: { display: false },
        },
      },
    },
  });
}

export function renderTopSummaryConsensusBar(canvas, consensusPapers, limit = 15, slrCount = null) {
  const slice = consensusPapers.slice(0, limit);
  const labels = slice.map((p) => truncateLabel(p.ref?.title, 32));
  const data = slice.map((p) => p.citingCount);
  topSummaryConsensusChart = destroyInstance(topSummaryConsensusChart);
  const totalSlrs = slrCount ?? "—";
  const Chart = ChartLib();
  topSummaryConsensusChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          data,
          backgroundColor: slice.map((p) =>
            p.inTopBenchmark ? "rgba(13, 148, 136, 0.75)" : "rgba(148, 163, 184, 0.55)"
          ),
          borderColor: slice.map((p) => (p.inTopBenchmark ? "rgb(13, 148, 136)" : "rgb(148, 163, 184)")),
          borderWidth: 1,
          borderRadius: 3,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 4, right: 12, bottom: 8, left: 4 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex ?? 0;
              return slice[i]?.ref?.title || "";
            },
            afterLabel(item) {
              const p = slice[item.dataIndex];
              if (!p) return "";
              const bits = [`${p.citingCount}/${totalSlrs} SLRs`];
              if (p.inTopBenchmark) bits.push(`benchmark #${p.topRank}`);
              return bits.join(" · ");
            },
          },
        },
      },
      scales: {
        x: {
          ...baseScaleOpts(),
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
        y: {
          ...baseScaleOpts(),
          grid: { display: false },
          ticks: { font: { size: 9 }, autoSkip: false },
        },
      },
    },
  });
}
