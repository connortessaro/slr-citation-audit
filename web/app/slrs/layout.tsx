import { ExplorerSidebar, type SidebarItem } from "@/components/explorer-sidebar";
import { getOverlap, getSLRs } from "@/lib/data";

export default function SLRsLayout({ children }: { children: React.ReactNode }) {
  const overlap = getOverlap();
  const slrs = getSLRs();
  const titleByKey = new Map(slrs.map((s) => [s.paper_key, s.title]));

  const items: SidebarItem[] = overlap
    .slice()
    .sort((a, b) => b.coverage_pct - a.coverage_pct)
    .map((o) => ({
      id: o.slr_id,
      title: o.slr_title || titleByKey.get(o.slr_id) || "(no title)",
      meta: `${o.slr_year || "-"} · ${o.slr_venue || ""}`.trim(),
      badge: `${o.coverage_pct.toFixed(0)}%`,
      badgeTone:
        o.coverage_pct >= 30
          ? "accent"
          : o.coverage_pct >= 15
            ? "warn"
            : o.coverage_pct > 0
              ? "default"
              : "miss",
    }));

  return (
    <div className="grid grid-cols-[320px_1fr]">
      <ExplorerSidebar
        basePath="/slrs"
        items={items}
        placeholder="Filter SLRs…"
      />
      <div className="min-h-[calc(100vh-3.5rem-1px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
