import { CommandPalette } from "./command-palette";
import { getOverlap, getSLRs, getTopCited } from "@/lib/data";

const NAV = [
  { id: "nav-overview", title: "Overview", href: "/", group: "Navigation" as const },
  { id: "nav-slrs", title: "SLRs", href: "/slrs", group: "Navigation" as const },
  { id: "nav-papers", title: "Top cited", href: "/papers", group: "Navigation" as const },
  { id: "nav-consensus", title: "Consensus", href: "/consensus", group: "Navigation" as const },
  { id: "nav-compare", title: "Compare", href: "/compare", group: "Navigation" as const },
  { id: "nav-graph", title: "Graph", href: "/graph", group: "Navigation" as const },
  { id: "nav-method", title: "Method", href: "/method", group: "Navigation" as const },
];

export function CommandPaletteMount() {
  const overlap = getOverlap();
  const slrs = getSLRs();
  const top = getTopCited();
  const titleByKey = new Map(slrs.map((s) => [s.paper_key, s.title]));

  const items = [
    ...NAV,
    ...overlap.map((o) => ({
      id: `slr-${o.slr_id}`,
      title: titleByKey.get(o.slr_id) || o.slr_title || o.slr_id,
      meta: `${o.slr_year || "—"} · cov ${o.coverage_pct.toFixed(0)}%`,
      href: `/slrs/${encodeURIComponent(o.slr_id)}`,
      group: "SLRs" as const,
    })),
    ...top.map((p) => ({
      id: `paper-${p.paper_key}`,
      title: p.title || p.paper_key,
      meta: `#${p.rank} · ${p.year ?? "—"} · ${(p.citationCount ?? 0).toLocaleString()} cites`,
      href: `/papers/${encodeURIComponent(p.paper_key)}`,
      group: "Top cited" as const,
    })),
  ];

  return <CommandPalette items={items} />;
}
