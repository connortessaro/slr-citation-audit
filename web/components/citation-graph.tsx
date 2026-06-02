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
          .backgroundColor("#06090c")
          .nodeRelSize(5)
          .nodeOpacity(0.95)
          .nodeResolution(20)
          .nodeColor(((n: GraphNode) => {
            if (n.kind === "top") return "#00ff95";
            const cov = n.coverage ?? 0;
            if (cov >= 30) return "#34d399";
            if (cov >= 15) return "#fbbf24";
            if (cov > 0) return "#94a3b8";
            return "#475569";
          }) as never)
          .nodeVal(((n: GraphNode) =>
            n.kind === "top"
              ? Math.log2((n.citationCount ?? 1) + 2) * 2.2
              : Math.max(1.5, (n.hits ?? 0) * 0.9 + 1.5)) as never)
          .nodeLabel(((n: GraphNode) =>
            `<div style="background:rgba(10,12,16,0.95);border:1px solid rgba(0,255,149,0.25);padding:8px 12px;border-radius:8px;font-family:'Geist Mono',ui-monospace,monospace;color:#ededed;max-width:320px;box-shadow:0 8px 32px rgba(0,255,149,0.08)">
              <div style="font-weight:600;font-size:11.5px;line-height:1.4">${(n.label || "").slice(0, 140)}${(n.label || "").length > 140 ? "…" : ""}</div>
              <div style="opacity:0.65;font-size:10px;margin-top:4px;letter-spacing:0.04em">${
                n.kind === "top"
                  ? `#${n.rank} ON REQUIRED LIST · ${n.citationCount?.toLocaleString() ?? 0} cites`
                  : `SLR · ${n.year ?? ""} · grade ${n.coverage?.toFixed(0) ?? 0}%`
              }</div>
            </div>`) as never)
          .linkColor(((l: { source: GraphNode | string; target: GraphNode | string }) => {
            const src = typeof l.source === "object" ? l.source : null;
            if (src && src.kind === "slr") {
              const c = src.coverage ?? 0;
              if (c >= 30) return "rgba(0, 255, 149, 0.45)";
              if (c >= 15) return "rgba(251, 191, 36, 0.30)";
              return "rgba(0, 255, 149, 0.12)";
            }
            return "rgba(0, 255, 149, 0.18)";
          }) as never)
          .linkWidth(0.6)
          .linkOpacity(0.55)
          .linkDirectionalParticles(2)
          .linkDirectionalParticleWidth(1.4)
          .linkDirectionalParticleSpeed(0.006)
          .linkDirectionalParticleColor((() => "#00ff95") as never)
          .onNodeClick(((n: GraphNode) => {
            onSelect(n);
            const node = n as GraphNode & { x?: number; y?: number; z?: number };
            const distance = 120;
            const distRatio = node.x && node.y && node.z
              ? 1 + distance / Math.hypot(node.x, node.y, node.z)
              : 1;
            graph.cameraPosition(
              {
                x: (node.x ?? 0) * distRatio,
                y: (node.y ?? 0) * distRatio,
                z: (node.z ?? 0) * distRatio,
              },
              { x: node.x ?? 0, y: node.y ?? 0, z: node.z ?? 0 } as never,
              900,
            );
          }) as never)
          .onBackgroundClick(() => onSelect(null))
          .showNavInfo(false)
          .width(el.clientWidth)
          .height(el.clientHeight);

        graph.d3VelocityDecay(0.28);
        graph.d3AlphaDecay(0.018);

        // Auto-orbit camera until first user interaction or 12s timeout
        let orbiting = true;
        let angle = 0;
        const orbitDistance = 380;
        const orbitInterval = setInterval(() => {
          if (!orbiting) return;
          angle += Math.PI / 600;
          graph.cameraPosition({
            x: orbitDistance * Math.sin(angle),
            y: orbitDistance * 0.18,
            z: orbitDistance * Math.cos(angle),
          });
        }, 16);
        const stopOrbit = () => {
          orbiting = false;
        };
        el.addEventListener("pointerdown", stopOrbit, { once: true });
        el.addEventListener("wheel", stopOrbit, { once: true });
        const autoStop = setTimeout(stopOrbit, 12000);

        const onResize = () => {
          graph.width(el.clientWidth).height(el.clientHeight);
        };
        window.addEventListener("resize", onResize);

        return () => {
          window.removeEventListener("resize", onResize);
          clearInterval(orbitInterval);
          clearTimeout(autoStop);
          el.removeEventListener("pointerdown", stopOrbit);
          el.removeEventListener("wheel", stopOrbit);
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
        <div className="relative mx-auto h-1.5 w-32 overflow-hidden rounded-full bg-[var(--color-border-strong)]/40">
          <div
            className="absolute top-0 h-full w-1/3 rounded-full bg-[var(--color-accent)] shadow-[0_0_12px_var(--color-accent)]"
            style={{ animation: "graph-loading-slide 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite" }}
          />
        </div>
        <div className="mt-5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
          Building citation network
        </div>
        <div className="mt-2 font-mono text-[10px] text-[var(--color-text-faint)]">
          force simulation · ~2s
        </div>
      </div>
      <style jsx>{`
        @keyframes graph-loading-slide {
          0% { left: -33%; }
          100% { left: 100%; }
        }
      `}</style>
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
      <h1 className="sr-only">
        3D citation network of {data.nodes.length} papers and{" "}
        {data.links.length} citation links
      </h1>

      {/* Mobile fallback */}
      <div className="block px-4 py-12 md:hidden">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
          3D citation graph
        </div>
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[var(--color-text)]">
          The graph view doesn&apos;t play nice with touch.
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-[var(--color-text-muted)]">
          {data.nodes.length} papers, {data.links.length} citation links.
          Pinch-zoom fights the WebGL pan on phones. Open this route on a
          desktop browser, or jump to the consensus list - same
          required-reading list, with which SLRs cited each paper.
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
        aria-label={`3D citation network of ${data.nodes.length} papers and ${data.links.length} citation links. Brighter nodes are the most-cited papers in the field; smaller nodes are SLRs colored by their grade.`}
        className="relative hidden h-[calc(100vh-3.5rem-1px)] w-full md:block"
      >
        <ForceGraph3D data={data} onSelect={setSelected} />

        {/* Legend */}
        <div className="pointer-events-none absolute left-6 top-6 max-w-xs rounded-lg border border-[var(--color-accent-soft)]/40 bg-[var(--color-bg-elevated)]/85 p-4 shadow-[0_8px_32px_rgba(0,255,149,0.06)] backdrop-blur-xl">
          <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--color-accent)]">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-accent)] shadow-[0_0_8px_var(--color-accent)]" />
            Live network
          </div>
          <p className="mt-2.5 text-sm leading-snug text-[var(--color-text-muted)]">
            Each glowing dot is a paper. Lines flow from SLRs into the papers
            they cite. Auto-orbit stops on first click or scroll.
          </p>
          <ul className="mt-3.5 space-y-1.5 font-mono text-[11px] text-[var(--color-text-muted)]">
            <li className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[#00ff95] shadow-[0_0_8px_#00ff95]" />
              <span>required-reading paper</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#34d399]" />
              SLR · grade ≥ 30%
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#fbbf24]" />
              SLR · grade 15-30%
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#94a3b8]" />
              SLR · grade 0-15%
            </li>
            <li className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-[#475569]" />
              SLR · grade 0% (cites nothing)
            </li>
          </ul>
        </div>

        {/* Selection panel */}
        {selected && (
          <div className="absolute right-6 top-6 max-w-sm rounded-lg border border-[var(--color-accent-soft)]/50 bg-[var(--color-bg-elevated)]/95 p-5 shadow-[0_12px_48px_rgba(0,0,0,0.6)] backdrop-blur-xl">
            <div className="flex items-center gap-2">
              <span
                className="rounded-md px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider"
                style={{
                  background:
                    selected.kind === "top"
                      ? "rgba(0, 255, 149, 0.14)"
                      : "var(--color-surface)",
                  color:
                    selected.kind === "top"
                      ? "var(--color-accent)"
                      : "var(--color-text)",
                  boxShadow:
                    selected.kind === "top"
                      ? "0 0 12px rgba(0, 255, 149, 0.18)"
                      : "none",
                }}
              >
                {selected.kind === "top"
                  ? `#${selected.rank} required`
                  : "SLR"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
                {selected.kind === "top"
                  ? "On the reading list"
                  : "Survey paper"}
              </span>
            </div>
            <h3 className="mt-3 line-clamp-3 text-sm font-semibold leading-snug text-[var(--color-text)]">
              {selected.label}
            </h3>
            <div className="mt-2 font-mono text-[11px] text-[var(--color-text-muted)]">
              {selected.year ?? ""}
              {selected.kind === "top" && selected.citationCount
                ? ` · ${selected.citationCount.toLocaleString()} cites on Semantic Scholar`
                : ""}
              {selected.kind === "slr" && selected.coverage !== undefined
                ? ` · grade ${selected.coverage.toFixed(1)}%`
                : ""}
            </div>
            {selected.kind === "slr" && selected.coverage !== undefined && (
              <div className="mt-3">
                <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-hover)]">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full transition-all"
                    style={{
                      width: `${Math.max(2, Math.min(100, selected.coverage))}%`,
                      background:
                        selected.coverage >= 30
                          ? "#34d399"
                          : selected.coverage >= 15
                            ? "#fbbf24"
                            : "#94a3b8",
                    }}
                  />
                </div>
              </div>
            )}
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
          <span className="text-[var(--color-accent)]">{data.nodes.length}</span>{" "}
          papers ·{" "}
          <span className="text-[var(--color-accent)]">{data.links.length}</span>{" "}
          citation links · drag to orbit · scroll to zoom
        </div>
      </div>
      </div>
    </div>
  );
}
