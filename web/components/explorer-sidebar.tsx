"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

export interface SidebarItem {
  id: string;
  title: string;
  meta?: string;
  badge?: string | number;
  badgeTone?: "default" | "accent" | "warn" | "miss";
}

interface Props {
  basePath: string;        // e.g. "/slrs"
  items: SidebarItem[];
  placeholder?: string;
}

export function ExplorerSidebar({ basePath, items, placeholder = "Filter…" }: Props) {
  const pathname = usePathname();
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(
      (it) =>
        it.title.toLowerCase().includes(needle) ||
        (it.meta ?? "").toLowerCase().includes(needle) ||
        it.id.toLowerCase().includes(needle),
    );
  }, [items, q]);

  return (
    <aside className="flex h-[calc(100vh-3.5rem-1px)] flex-col border-r border-[var(--color-border)] bg-[var(--color-bg-elevated)]/50">
      <div className="border-b border-[var(--color-border)] p-3">
        <input
          type="search"
          placeholder={placeholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 py-1.5 text-xs placeholder:text-[var(--color-text-faint)] focus:border-[var(--color-accent)] focus:outline-none"
        />
        <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)]">
          {filtered.length} of {items.length}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.map((it) => {
          const href = `${basePath}/${encodeURIComponent(it.id)}`;
          const active = pathname === href;
          return (
            <Link
              key={it.id}
              href={href}
              className={cn(
                "block rounded-md px-3 py-2 transition-colors",
                active
                  ? "bg-[var(--color-surface)] ring-1 ring-inset ring-[var(--color-accent-soft)]"
                  : "hover:bg-[var(--color-surface)]/60",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="line-clamp-2 text-xs leading-snug text-[var(--color-text)]">
                  {it.title}
                </div>
                {it.badge !== undefined && (
                  <span
                    className={cn(
                      "shrink-0 rounded font-mono text-[10px] tabular-nums",
                      it.badgeTone === "accent"
                        ? "bg-[var(--color-accent-soft)] px-1.5 py-0.5 text-[var(--color-accent)]"
                        : it.badgeTone === "warn"
                          ? "bg-[var(--color-warn)]/10 px-1.5 py-0.5 text-[var(--color-warn)]"
                          : it.badgeTone === "miss"
                            ? "bg-[var(--color-miss)]/10 px-1.5 py-0.5 text-[var(--color-miss)]"
                            : "px-1 py-0.5 text-[var(--color-text-subtle)]",
                    )}
                  >
                    {it.badge}
                  </span>
                )}
              </div>
              {it.meta && (
                <div className="mt-1 truncate font-mono text-[10px] text-[var(--color-text-faint)]">
                  {it.meta}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
