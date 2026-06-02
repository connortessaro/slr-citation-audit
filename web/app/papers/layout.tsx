import { ExplorerSidebar, type SidebarItem } from "@/components/explorer-sidebar";
import { getTopCited } from "@/lib/data";

export default function PapersLayout({ children }: { children: React.ReactNode }) {
  const top = getTopCited();
  const items: SidebarItem[] = top.map((p) => ({
    id: p.paper_key,
    title: p.title || "(no title)",
    meta: `${p.year ?? "-"} · ${(p.authors ?? []).slice(0, 2).join(", ")}`,
    badge: `#${p.rank}`,
    badgeTone: "accent",
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr]">
      <ExplorerSidebar
        basePath="/papers"
        items={items}
        placeholder="Filter top-50…"
      />
      <div className="min-h-[calc(100vh-3.5rem-1px)] overflow-y-auto">
        {children}
      </div>
    </div>
  );
}
