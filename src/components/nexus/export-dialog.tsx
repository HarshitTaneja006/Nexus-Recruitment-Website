"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckSquare, Download, Square, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface CatalogField {
  key: string;
  label: string;
  group: string;
}

interface Catalog {
  groups: Array<{ id: string; label: string }>;
  fields: CatalogField[];
  defaults: string[];
}

const PRESETS: Record<string, string[]> = {
  FULL: [],
  CONTACT: ["full_name", "email", "whatsapp", "year_of_study", "department", "status"],
  INTERVIEW: [
    "full_name",
    "email",
    "whatsapp",
    "department",
    "status",
    "interview_at",
    "interview_mode",
    "interview_panel",
    "status_note",
  ],
  ROUND1: [
    "full_name",
    "email",
    "department",
    "status",
    "round1_problem_statement",
    "round1_github_url",
    "round1_report_url",
    "round1_deploy_url",
    "round1_submitted_at",
  ],
};

export function ExportDialog({
  open,
  onClose,
  department,
  status,
  year,
  query,
  order,
  filteredCount,
  selectedIds,
}: {
  open: boolean;
  onClose: () => void;
  department: string;
  status: string;
  year: string;
  query: string;
  order: string;
  filteredCount: number;
  selectedIds: string[];
}) {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [checked, setChecked] = useState<string[] | null>(null);
  const [scope, setScope] = useState<"filtered" | "selected">("filtered");
  const [format, setFormat] = useState<"csv" | "json">("csv");

  useEffect(() => {
    if (!open) return;
    // default the scope to ticked rows when the dialog opens with a selection
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setScope(selectedIds.length > 0 ? "selected" : "filtered");
    let live = true;
    fetch("/api/admin/applications/export/fields", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: Catalog | null) => {
        if (!live || !d) return;
        setCatalog(d);
        setChecked((prev) => prev ?? d.defaults);
      })
      .catch(() => {
        if (live) toast.error("EXPORT_FIELDS_OFFLINE");
      });
    return () => {
      live = false;
    };
  }, [open, selectedIds.length]);

  const rowCount = scope === "selected" ? selectedIds.length : filteredCount;

  const href = useMemo(() => {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    if (year) params.set("year", year);
    if (query) params.set("q", query);
    if (order !== "newest") params.set("order", order);
    if (scope === "selected" && selectedIds.length > 0)
      params.set("ids", selectedIds.join(","));
    const allKeys = catalog?.defaults ?? [];
    const active = checked ?? allKeys;
    if (active.length > 0 && active.length < allKeys.length)
      params.set("fields", active.join(","));
    if (format === "json") params.set("format", "json");
    const qs = params.toString();
    return `/api/admin/applications/export${qs ? `?${qs}` : ""}`;
  }, [department, status, year, query, order, scope, selectedIds, checked, catalog, format]);

  const toggle = (key: string) =>
    setChecked((prev) => {
      const base = prev ?? catalog?.defaults ?? [];
      return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
    });

  const applyPreset = (name: string) => {
    if (name === "FULL") {
      setChecked(catalog?.defaults ?? []);
      return;
    }
    setChecked(PRESETS[name] ?? []);
  };

  const grouped = useMemo(() => {
    if (!catalog) return [];
    return catalog.groups.map((g) => ({
      ...g,
      fields: catalog.fields.filter((f) => f.group === g.id),
    }));
  }, [catalog]);

  const activeCount = (checked ?? catalog?.defaults ?? []).length;
  const totalCount = catalog?.defaults.length ?? 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-border bg-popover font-mono sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-left text-sm tracking-widest">
            <span className="text-primary">$ export</span> --custom
          </DialogTitle>
          <DialogDescription className="text-left font-mono text-[10px] text-muted-foreground">
            filtered rows + ticked records, caller-chosen columns. What you pick is
            what lands in the file.
          </DialogDescription>
        </DialogHeader>

        {/* scope */}
        <div className="flex gap-1.5" role="radiogroup" aria-label="Export scope">
          <ScopeButton
            active={scope === "filtered"}
            onClick={() => setScope("filtered")}
            label={`FILTERED (${filteredCount})`}
          />
          <ScopeButton
            active={scope === "selected"}
            onClick={() => setScope("selected")}
            label={`TICKED (${selectedIds.length})`}
            disabled={selectedIds.length === 0}
          />
          <div className="ml-auto flex gap-1.5" role="radiogroup" aria-label="Export format">
            {(["csv", "json"] as const).map((f) => (
              <button
                key={f}
                type="button"
                role="radio"
                aria-checked={format === f}
                onClick={() => setFormat(f)}
                className={cn(
                  "border px-2 py-1 text-[9px] tracking-widest transition-colors",
                  format === f
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">
            preset:
          </span>
          {["FULL", "CONTACT", "INTERVIEW", "ROUND1"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => applyPreset(p)}
              className="border border-border px-2 py-1 text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
            >
              {p}
            </button>
          ))}
          <span className="ml-auto text-[9px] tracking-widest text-muted-foreground/60 tabular-nums">
            {activeCount}/{totalCount} COLS · {rowCount} ROWS
          </span>
        </div>

        {/* field picker */}
        {!catalog ? (
          <div className="space-y-2 py-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse bg-secondary/40" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.map((g) => {
              const keys = g.fields.map((f) => f.key);
              const active = checked ?? catalog.defaults;
              const allOn = keys.every((k) => active.includes(k));
              return (
                <section key={g.id} aria-label={`${g.label} fields`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                      {g.label} · {g.fields.filter((f) => active.includes(f.key)).length}/{g.fields.length}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setChecked((prev) => {
                          const base = prev ?? catalog.defaults;
                          return allOn
                            ? base.filter((k) => !keys.includes(k))
                            : [...new Set([...base, ...keys])]
                        })
                      }
                      className="text-[9px] tracking-widest text-primary/80 hover:text-primary"
                    >
                      {allOn ? "NONE" : "ALL"}
                    </button>
                  </div>
                  <ul className="mt-1.5 grid gap-1 sm:grid-cols-2">
                    {g.fields.map((f) => {
                      const on = active.includes(f.key);
                      return (
                        <li key={f.key}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            title={f.label}
                            onClick={() => toggle(f.key)}
                            className={cn(
                              "flex w-full items-center gap-2 border px-2 py-1.5 text-left text-[10px] transition-colors",
                              on
                                ? "border-primary/50 bg-primary/10 text-foreground"
                                : "border-border text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {on ? (
                              <CheckSquare className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
                            ) : (
                              <Square className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            )}
                            <span className="min-w-0">
                              <span className="block truncate tracking-wider">{f.key}</span>
                              {f.label !== f.key ? (
                                <span className="block truncate text-[9px] text-muted-foreground/70">
                                  {f.label.slice(0, 80)}
                                </span>
                              ) : null}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        {/* footer */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 border border-border px-3 text-[10px] tracking-widest text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" /> CLOSE
          </button>
          <a
            href={activeCount === 0 || rowCount === 0 ? undefined : href}
            aria-disabled={activeCount === 0 || rowCount === 0}
            onClick={(e) => {
              if (activeCount === 0 || rowCount === 0) {
                e.preventDefault();
                toast.warning("NOTHING_TO_EXPORT", {
                  description:
                    activeCount === 0 ? "Tick at least one column." : "No rows match this scope.",
                });
              } else {
                toast.success(`EXPORT_QUEUED · ${rowCount} × ${activeCount}`, {
                  description: `${format.toUpperCase()} download starting.`,
                });
              }
            }}
            className={cn(
              "inline-flex h-9 items-center gap-2 border px-3 text-[10px] tracking-widest transition-colors",
              activeCount === 0 || rowCount === 0
                ? "cursor-not-allowed border-border text-muted-foreground/50"
                : "border-primary/50 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground"
            )}
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            DOWNLOAD_{format.toUpperCase()} ({rowCount}×{activeCount})
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScopeButton({
  active,
  onClick,
  label,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "border px-2.5 py-1.5 text-[10px] tracking-widest transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      {label}
    </button>
  );
}
