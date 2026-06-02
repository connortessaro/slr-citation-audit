"use client";

import { Command } from "cmdk";
import { motion, AnimatePresence } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface PaletteItem {
  id: string;
  title: string;
  meta?: string;
  href: string;
  group: "Navigation" | "SLRs" | "Top cited";
}

interface Props {
  items: PaletteItem[];
}

export function CommandPalette({ items }: Props) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    const onOpenEvent = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("slr-cmdk-open", onOpenEvent);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("slr-cmdk-open", onOpenEvent);
    };
  }, []);

  const grouped: Record<string, PaletteItem[]> = {};
  for (const it of items) {
    if (!grouped[it.group]) grouped[it.group] = [];
    grouped[it.group].push(it);
  }

  const select = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-bg-elevated)] shadow-[0_24px_80px_-12px_rgba(0,0,0,0.8)]"
          >
            <Command className="flex flex-col">
              <Command.Input
                autoFocus
                placeholder="Search SLRs, papers, navigation…"
                className="w-full border-b border-[var(--color-border)] bg-transparent px-4 py-3 text-sm placeholder:text-[var(--color-text-faint)] focus:outline-none"
              />
              <Command.List className="max-h-[60vh] overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-sm text-[var(--color-text-subtle)]">
                  No results.
                </Command.Empty>
                {Object.entries(grouped).map(([group, list]) => (
                  <Command.Group
                    key={group}
                    heading={group}
                    className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-subtle)] [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-2"
                  >
                    {list.map((it) => (
                      <Command.Item
                        key={it.id}
                        value={`${it.title} ${it.meta ?? ""}`}
                        onSelect={() => select(it.href)}
                        className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm transition-colors aria-selected:bg-[var(--color-surface)] aria-selected:text-[var(--color-text)] data-[selected=true]:bg-[var(--color-surface)]"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-[var(--color-text)]">
                            {it.title}
                          </div>
                          {it.meta && (
                            <div className="mt-0.5 truncate font-mono text-[11px] text-[var(--color-text-faint)]">
                              {it.meta}
                            </div>
                          )}
                        </div>
                        <span className="font-mono text-[10px] text-[var(--color-text-subtle)]">
                          ↵
                        </span>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
              <div className="flex items-center justify-between border-t border-[var(--color-border)] px-3 py-2 font-mono text-[10px] text-[var(--color-text-subtle)]">
                <span>
                  <kbd className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5">
                    ↑↓
                  </kbd>{" "}
                  navigate ·{" "}
                  <kbd className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5">
                    ↵
                  </kbd>{" "}
                  open ·{" "}
                  <kbd className="rounded border border-[var(--color-border-strong)] px-1.5 py-0.5">
                    esc
                  </kbd>{" "}
                  close
                </span>
                <span className="text-[var(--color-accent)]">slr.audit</span>
              </div>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
