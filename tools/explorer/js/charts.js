/**
 * Chart.js helpers for overview charts.
 */

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
          backgroundColor: "rgba(37, 99, 235, 0.75)",
          borderColor: "rgb(37, 99, 235)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: "Coverage distribution (% of eligible top-50 cited)" },
      },
      scales: {
        x: { title: { display: true, text: "Coverage (%)" } },
        y: { title: { display: true, text: "Number of SLRs" }, beginAtZero: true, ticks: { stepSize: 1 } },
      },
    },
  });
}

export function renderTopCitedBar(canvas, topCited, limit = 15) {
  const slice = topCited.slice(0, limit);
  const labels = slice.map((p, i) => `#${p._rank ?? i + 1}`);
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
          backgroundColor: "rgba(5, 150, 105, 0.7)",
          borderColor: "rgb(5, 150, 105)",
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: { display: true, text: `Top ${limit} papers by citation count (corpus)` },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex ?? 0;
              return slice[i]?.title || "";
            },
          },
        },
      },
      scales: {
        x: { title: { display: true, text: "Citations (Semantic Scholar)" }, beginAtZero: true },
      },
    },
  });
}

export function renderConsensusBar(canvas, consensusPapers, limit = 20, slrCount = null) {
  const slice = consensusPapers.slice(0, limit);
  const labels = slice.map((p) => `#${p.citingCount}`);
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
            p.inTop50 ? "rgba(37, 99, 235, 0.75)" : "rgba(100, 116, 139, 0.65)"
          ),
          borderColor: slice.map((p) => (p.inTop50 ? "rgb(37, 99, 235)" : "rgb(100, 116, 139)")),
          borderWidth: 1,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Top ${limit} papers by SLR consensus (# SLRs citing each)`,
        },
        tooltip: {
          callbacks: {
            title(items) {
              const i = items[0]?.dataIndex ?? 0;
              const p = slice[i];
              return p?.ref.title || "";
            },
            afterLabel(item) {
              const p = slice[item.dataIndex];
              if (!p) return "";
              const bits = [`${p.citingCount}/${totalSlrs} SLRs`];
              if (p.inTop50) bits.push(`top-50 rank #${p.topRank}`);
              return bits.join(" · ");
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Number of SLRs citing this paper" },
          beginAtZero: true,
          ticks: { stepSize: 1 },
        },
      },
    },
  });
}

export function renderSlrCoverageGauge(canvas, coveragePct) {
  const pct = coveragePct ?? 0;
  const Chart = ChartLib();
  return new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Cited", "Not cited"],
      datasets: [
        {
          data: [pct, Math.max(0, 100 - pct)],
          backgroundColor: ["rgb(37, 99, 235)", "rgb(226, 232, 240)"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      circumference: 180,
      rotation: 270,
      cutout: "72%",
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
    plugins: [
      {
        id: "centerText",
        afterDraw(chart) {
          const { ctx, chartArea } = chart;
          ctx.save();
          ctx.font = "bold 22px system-ui";
          ctx.fillStyle = "#0f172a";
          ctx.textAlign = "center";
          ctx.fillText(`${pct.toFixed(1)}%`, (chartArea.left + chartArea.right) / 2, chartArea.bottom - 8);
          ctx.restore();
        },
      },
    ],
  });
}
