"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { ChevronRight, Link2 } from "lucide-react";
import { toast } from "sonner";
import { SectionHeading } from "./section-heading";
import { DEPARTMENTS, COMMON_QUESTIONS, getDepartmentHex } from "@/lib/departments";
import { cn } from "@/lib/utils";

interface DeptStats {
  total: number;
  byDepartment: Record<string, number>;
}

export function DepartmentsSection() {
  const [openDir, setOpenDir] = useState<string | null>(null);
  const [stats, setStats] = useState<DeptStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data) setStats(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="departments" className="border-b border-border grid-backdrop" aria-label="Departments">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 md:py-24">
        <SectionHeading
          index="02"
          tag="DOMAIN_LOAD.EXE"
          title={
            <>
              Three departments, <span className="text-primary glow-soft">one</span> workbench
            </>
          }
          subtitle="Pick the directory where you want to compile yourself. Each department runs weekly builds, owns real work, and answers pull requests from members of every year. Inspect a directory to preview its recruitment questions."
        />

        <div className="grid gap-4 md:grid-cols-2">
          {DEPARTMENTS.map((dept) => (
            <DeptCard
              key={dept.id}
              deptId={dept.id}
              open={openDir === dept.id}
              load={stats ? (stats.byDepartment[dept.id] ?? 0) : null}
              onToggle={() => setOpenDir(openDir === dept.id ? null : dept.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** One domain directory - deep-linkable via #d-<id> with an accent-tinted hover. */
function DeptCard({
  deptId,
  open,
  load,
  onToggle,
}: {
  deptId: string;
  open: boolean;
  load: number | null;
  onToggle: () => void;
}) {
  const dept = DEPARTMENTS.find((d) => d.id === deptId);

  const copyLink = useCallback(() => {
    const url = `${window.location.origin}/?dept=${deptId}#d-${deptId}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success("DEPT_LINK_COPIED", { description: url }))
      .catch(() => toast.error("CLIPBOARD_BLOCKED", { description: url }));
  }, [deptId]);

  if (!dept) return null;

  return (
    <article
      id={`d-${deptId}`}
      style={{ "--dept-accent": getDepartmentHex(dept.id) } as CSSProperties}
      className={cn(
        "terminal-panel dept-card group relative flex scroll-mt-24 flex-col transition-all",
        open ? "border-primary/50" : "hover:border-primary/40"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <p className="font-mono text-xs text-muted-foreground">
          <span className="text-primary">d</span> {dept.dir}/
        </p>
        <div className="flex items-center gap-2">
          <span
            className="border border-border bg-background/60 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.15em] text-primary/80"
            title="Live application count for this domain"
          >
            LOAD: {load !== null ? String(load).padStart(2, "0") : "--"}
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            {dept.questions.length}+{COMMON_QUESTIONS.length} Q
          </p>
          <button
            type="button"
            onClick={copyLink}
            aria-label={`Copy deep link to the ${dept.name} directory`}
            title="copy directory deep link"
            className="inline-flex h-6 w-6 items-center justify-center border border-transparent text-muted-foreground/50 opacity-60 transition-all hover:border-border hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
          >
            <Link2 className="h-3 w-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className={cn("font-mono text-lg font-bold tracking-tight", dept.accentClass)}>
          {dept.name}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {dept.tagline}
        </p>
        <p className="mt-3 flex-1 font-sans text-sm leading-relaxed text-muted-foreground">
          {dept.description}
        </p>

        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label={`${dept.name} stack`}>
          {dept.tags.map((tag) => (
            <li
              key={tag}
              className="border border-border bg-secondary/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground transition-colors group-hover:border-[color-mix(in_srgb,var(--dept-accent)_35%,transparent)]"
            >
              {tag}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={`dept-questions-${dept.id}`}
          className="mt-5 inline-flex w-full items-center justify-between border border-border bg-secondary/40 px-3 py-2 font-mono text-xs tracking-wider text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <span>$ {open ? "close" : "inspect"} --questions</span>
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", open && "rotate-90")}
            aria-hidden="true"
          />
        </button>

        {open && (
          <ol
            id={`dept-questions-${dept.id}`}
            className="mt-3 space-y-2 border border-border/60 bg-background/60 p-3"
          >
            {[...COMMON_QUESTIONS.slice(0, 1), ...dept.questions].map((q, i) => (
              <li key={q.id} className="flex gap-2 font-mono text-[11px] leading-relaxed">
                <span className="shrink-0 text-primary">
                  {String(i).padStart(2, "0")}
                </span>
                <span className="text-muted-foreground">{q.label}</span>
              </li>
            ))}
            <li className="pt-1 font-mono text-[10px] text-muted-foreground/60">
              + {COMMON_QUESTIONS.length - 1} common questions · answer all inside the form
            </li>
          </ol>
        )}
      </div>
    </article>
  );
}
