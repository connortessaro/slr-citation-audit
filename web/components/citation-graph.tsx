"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import type { GraphData, GraphNode } from "@/lib/graph-data";

// 3d-force-graph is a vanilla Three.js library, not React. Import dynamically
// to avoid SSR (it touches window/document at module level).
const ForceGraph3D = dynamic(
  () => import("3d-force-graph").then((mod) => ({
    default: function ForceGraph({ data, onSelect }: { data: GraphData; onSelect: (n: GraphNode | null) => void }) {
      const ref = useRef<HTMLDivElement>(null);
      useEffect(() => {
        if (!ref.current) return;
        const el = ref.current;
        const FG = mod.default;
        const graph = new FG(el)
          .graphData({
            nodes: data.nodes.map((n) => ({ ...n })),
            links: data.links.map((l) => ({ ...l })),
          })
          .backgroundColor("#0a0a0a")
          .nodeRelSize(4)
          .nodeColor(((n: GraphNode) => {
            if (n.kind === "top") return "#00ff88";
            const cov = n.coverage ?? 0;
            if (cov >= 30) return "#34d399";
            if (cov >= 15) return "#fbbf24";
            if (cov > 0) return "#94a3b8";
            return "#475569";
          }) as never)
          .nodeVal(((n: GraphNode) =>
            n.kind === "top"
              ? Math.log2((n.citationCount ?? 1) + 2) * 1.5
              : Math.max(1, (n.hits ?? 0) * 0.7 + 1)) as never)
          .nodeLabel(((n: GraphNode) =>
            `<div style="background:#161616;border:1px solid rgba(255,255,255,0.12);padding:6px 10px;border-radius:6px;font-family:'Geist Mono',monospace;color:#ededed;max-width:280px"><div style="font-weight:600;font-size:11px">${(n.label || "").slice(0, 120)}${(n.label || "").length > 120 ? "…" : ""}</div><div style="opacity:0.6;font-size:10px;margin-top:2px">${n.kind === "top" ? `#${n.rank} · ${n.citationCount?.toLocaleString() ?? 0} cites` : `${n.year ?? ""} · cov ${n.coverage?.toFixed(0) ?? 0}%`}</div></div>`) as never)
          .linkColor(() => "rgba(0, 255, 136, 0.15)")
          .linkWidth(0.5)
          .linkOpacity(0.4)
          .linkDirectionalParticles(0)
          .onNodeClick(((n: GraphNode) => onSelect(n)) as never)
          .onBackgroundClick(() => onSelect(null))
          .showNavInfo(false)
          .width(el.clientWidth)
          .height(el.clientHeight);

        // Pre-cool the simulation to settle layout faster
        graph.d3VelocityDecay(0.3);

        const onResize = () => {
          graph.width(el.clientWidth).height(el.clientHeight);
        };
        window.addEventListener("resize", onResize);

        return () => {
          window.removeEventListener("resize", onResize);
          // 3d-force-graph manages internal Three.js cleanup on element removal
          el.innerHTML = "";
        };
      }, [data, onSelect]);

      return <div ref={ref} className="absolute inset-0" />;
    },
  })),
  { ssr: false, loading: () => <GraphLoading /> },
);

function GraphLoading() {
  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center">
        <div className="mx-auto h-1 w-24 overflow-hidden rounded-full bg-[var(--color-border-strong)]">
          <div className="h-full w-1/3 animate-pulse bg-[var(--color-accent)]" />
        </div>
        <div className="mt-4 font-mono text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          Loading citation network…
        </div>
      </div>
    </div>
  );
}

interface Props {
  data: GraphData;
}

export function CitationGraph({ data }: Props) {
  const [selected, setSelected] = useState<GraphNode | null>(null);

  return (
    <div className="relative w-full md:h-[calc(100vh-3.5rem-1px)]">
      {/* sr-only h1 — every page should have one. The desktop canvas has
          no visible heading; the mobile fallback shows the visible one. */}
      <h1 className="sr-only">
        3D citation graph · {data.nodes.length} nodes · {data.links.length}{" "}
        edges
      </h1>

      {/* Mobile fallback: WebGL pan + native pinch-zoom fight on touch. */}
      <div className="block px-4 py-12 md:hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
          3D citation graph
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          The graph view doesn&apos;t play nice with touch.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {data.nodes.length} nodes, {data.links.length} edges. Pinch-zoom
          fights the WebGL pan on phones. Open this route on a desktop
          browser, or jump to the consensus list — same canonical top-N
          and which reviews actually cite each one.
        </p>
        <a
          href="/consensus"
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-md border border-[var(--color-accent-soft)] bg-[var(--color-accent-soft)] px-4 font-mono text-sm text-[var(--color-accent)] hover:bg-[var(--color-accent)]/20"
        >
          Open consensus list →
        </a>
        <div className="mt-8 font-mono text-[11px] text-[var(--color-text-subtle)]">
          Desktop URL: {" "}
          <code className="text-[var(--color-text-muted)]">/graph</code>
        </div>
      </div>

      {/* Desktop 3D canvas + overlays */}
      <div
        role="img"
        aria-label={`3D citation network of ${data.nodes.length} nodes and ${data.links.length} edges. Each node is an SLR or top-cited paper; edges connect SLRs to the top papers they cite.`}
        className="relative hidden h-[calc(100vh-3.5rem-1px)] w-full md:block"
      >
        <ForceGraph3D data={data} onSelect={setSelected} />

      {/* Legend */}
      <div className="pointer-events-none absolute left-6 top-6 max-w-xs rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)]/85 p-4 backdrop-blur-md">
        <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-subtle)]">
          Citation network
        </div>
        <p className="mt-2 text-sm leading-snug text-[var(--color-text-muted)]">
          Each node is an SLR or a top-cited paper. Edges = SLR cites top
          paper.
        </p>
        <ul className="mt-3 space-y-1.5 font-mono text-[11px] text-[var(--color-text-muted)]">
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[var(--color-accent)]" />
            top-cited paper
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#34d399]" />
            SLR · cov ≥ 30%
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#fbbf24]" />
            SLR · cov 15–30%
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#94a3b8]" />
            SLR · cov 0–15%
          </li>
          <li className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-[#475569]" />
            SLR · 0%
          </li>
        </ul>
      </div>

      {/* Selection panel */}
      {selected && (
        <div className="absolute right-6 top-6 max-w-sm rounded-md border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)]/95 p-5 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider"
              style={{
                background:
                  selected.kind === "top"
                    ? "rgba(0, 255, 136, 0.12)"
                    : "var(--color-surface)",
                color:
                  selected.kind === "top"
                    ? "var(--color-accent)"
                    : "var(--color-text)",
              }}
            >
              {selected.kind === "top" ? `#${selected.rank}` : "SLR"}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
              {selected.kind === "top" ? "Top cited" : "Systematic review"}
            </span>
          </div>
          <h3 className="mt-2 line-clamp-3 text-sm font-semibold text-[var(--color-text)]">
            {selected.label}
          </h3>
          <div className="mt-2 font-mono text-[11px] text-[var(--color-text-muted)]">
            {selected.year ?? ""}
            {selected.kind === "top" && selected.citationCount
              ? ` · ${selected.citationCount.toLocaleString()} cites`
              : ""}
            {selected.kind === "slr" && selected.coverage !== undefined
              ? ` · cov ${selected.coverage.toFixed(1)}%`
              : ""}
          </div>
          <a
            href={
              selected.kind === "top"
                ? `/papers/${encodeURIComponent(selected.id)}`
                : `/slrs/${encodeURIComponent(selected.id)}`
            }
            className="mt-4 inline-flex items-center gap-1 font-mono text-xs text-[var(--color-accent)] hover:underline"
          >
            Open detail →
          </a>
        </div>
      )}

      {/* Stats footer */}
      <div className="pointer-events-none absolute bottom-6 left-6 font-mono text-[11px] text-[var(--color-text-subtle)]">
        {data.nodes.length} nodes · {data.links.length} edges
      </div>
      </div>
    </div>
  );
}
