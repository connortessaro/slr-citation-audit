/**
 * Chart.js helpers for overview charts.
 */

const CHART_FONT = '"IBM Plex Sans", system-ui, sans-serif';
const CHART_GRID_Y = "rgba(148, 163, 184, 0.08)";
const CHART_SLATE = "rgba(100, 116, 139, 0.72)";
const CHART_SLATE_BORDER = "rgb(100, 116, 139)";

let coverageChart = null;
let topCitedChart = null;
let consensusChart = null;

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

export function destroyCharts() {
  if (coverageChart) {
    coverageChart.destroy();
    coverageChart = null;
  }
  if (topCitedChart) {
    topCitedChart.destroy();
    topCitedChart = null;
  }
  if (consensusChart) {
    consensusChart.destroy();
    consensusChart = null;
  }
}

export function renderCoverageHistogram(canvas, slrs) {
  const bins = Array(10).fill(0);
  for (const s of slrs) {
    if (!Number.isFinite(s.coveragePct)) continue;
    const idx = Math.min(9, Math.floor(s.coveragePct / 10));
    bins[idx]++;
  }
  const labels = ["0–9", "10–19", "20–29", "30–39", "40–49", "50–59", "60–69", "70–79", "80–89", "90–100"];
  if (coverageChart) coverageChart.destroy();
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

function truncateLabel(title, max = 32) {
  const t = title || "Untitled";
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export function renderTopCitedBar(canvas, topCited, limit = 10) {
  const slice = topCited.slice(0, limit);
  const labels = slice.map((p) => {
    const yr = p.year != null ? ` · ${p.year}` : "";
    return truncateLabel(p.title, 30) + yr;
  });
  const data = slice.map((p) => p.citationCount ?? 0);
  if (topCitedChart) topCitedChart.destroy();
  const Chart = ChartLib();
  topCitedChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Citation count",
          data,
          backgroundColor: CHART_SLATE,
          borderColor: CHART_SLATE_BORDER,
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
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex ?? 0;
              const p = slice[i];
              return p ? `#${p._rank ?? "?"} · ${p.title || ""}` : "";
            },
          },
        },
      },
      scales: {
        x: {
          ...baseScaleOpts(),
          title: {
            display: true,
            text: "Citations (Semantic Scholar)",
            font: { family: CHART_FONT, size: 11 },
            color: "#64748b",
          },
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
}

export function resizeOverviewCharts() {
  coverageChart?.resize();
  topCitedChart?.resize();
}

export function renderConsensusBar(canvas, consensusPapers, limit = 20, slrCount = null) {
  const slice = consensusPapers.slice(0, limit);
  const labels = slice.map((p) => truncateLabel(p.ref?.title, 36));
  const data = slice.map((p) => p.citingCount);
  if (consensusChart) consensusChart.destroy();
  const Chart = ChartLib();
  const totalSlrs = slrCount ?? slice[0]?.citingSlrs?.length ?? "—";
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
