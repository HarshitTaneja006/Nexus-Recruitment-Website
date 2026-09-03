"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw, Activity, Layers, Users, TrendingUp, CheckCircle2, Link2, ClipboardCopy } from "lucide-react";
import { toast } from "sonner";
import { DEPARTMENTS, getDepartment } from "@/lib/departments";
import {
  STATUS_META,
  STATUS_PIPELINE,
  TERMINAL_STATUSES,
  type ApplicationStatus,
} from "@/lib/status";
import type { DriveStats } from "@/lib/storage";
import { DRIVE_DEADLINE } from "@/lib/drive";
import { useDriveOpen } from "@/lib/drive-client";
import { cn } from "@/lib/utils";

const DEPT_BAR_COLORS: Record<string, string> = {
  webdev: "bg-sky-400",
  aiml: "bg-emerald-400",
  finance: "bg-amber-400",
  design_social: "bg-fuchsia-400",
};

const REFRESH_MS = 20_000;

/** rAF count-up — animates 0→value once per mount; value changes snap. */
function useCountUp(value: number, duration = 900): number {
  const [display, setDisplay] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const from = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (value - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);
  return display;
}

function KpiCell({
  icon,
  label,
  value,
  suffix,
  accent,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix?: string;
  accent: string;
  hint: string;
}) {
  const shown = useCountUp(value);
  return (
    <div
      className="group relative border border-border bg-card p-4 transition-colors hover:border-primary/40"
      title={hint}
    >
      <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          "mt-2 font-mono text-3xl font-bold tabular-nums tracking-tight sm:text-4xl",
          accent
        )}
      >
        {String(shown).padStart(2, "0")}
        {suffix ? (
          <span className="ml-1 text-sm font-normal text-muted-foreground">{suffix}</span>
        ) : null}
      </p>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
      />
    </div>
  );
}

/** Horizontal stage bar with block-glyph fill and count. */
function StageBar({
  label,
  count,
  total,
  barClass,
  ChipIcon,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
  ChipIcon?: React.ReactNode;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  const blocks = Math.max(count > 0 ? 1 : 0, Math.round((pct / 100) * 24));
  const fill = "▓".repeat(blocks) + "░".repeat(24 - blocks);
  return (
    <li className="group">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground">
          {ChipIcon}
          {label}
        </span>
        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
          <span className="text-foreground">{String(count).padStart(3, "0")}</span>
          {" · "}
          {pct.toFixed(0)}%
        </span>
      </div>
      <div
        className="mt-1 flex items-center gap-3"
        role="meter"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${label}: ${count} of ${total} applications`}
      >
        <div className="hidden flex-1 overflow-hidden sm:block">
          <pre
            aria-hidden="true"
            className={cn(
              "select-none font-mono text-[11px] leading-none tracking-[0.05em] transition-all",
              count > 0 ? barClass.replace("bg-", "text-") : "text-border"
            )}
          >
            {fill}
          </pre>
        </div>
        <div className="h-2 flex-1 overflow-hidden bg-secondary/60 sm:hidden" aria-hidden="true">
          <div
            className={cn("h-full transition-all duration-700", barClass)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </li>
  );
}

/** Stacked per-department review-pipeline bar (colors = STATUS_META). */
function DeptStack({
  deptId,
  counts,
  total,
  focused,
}: {
  deptId: string;
  counts: Record<string, number>;
  total: number;
  focused: boolean;
}) {
  const dept = getDepartment(deptId);
  const deptTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const share = total > 0 ? (deptTotal / total) * 100 : 0;

  const copyAnchor = useCallback(() => {
    const url = `${window.location.origin}/stats#dept-${deptId}`;
    navigator.clipboard
      ?.writeText(url)
      .then(() => toast.success("ANCHOR_COPIED", { description: url }))
      .catch(() => toast.error("CLIPBOARD_BLOCKED", { description: url }));
  }, [deptId]);

  return (
    <div
      id={`dept-${deptId}`}
      className={cn(
        "group relative scroll-mt-32 border bg-card p-4 transition-colors hover:border-primary/40",
        focused ? "border-primary/70 ring-1 ring-primary/40" : "border-border"
      )}
    >
      {focused ? (
        <span className="absolute left-0 top-0 border-b border-r border-primary/70 bg-primary/15 px-1.5 py-px font-mono text-[8px] tracking-[0.2em] text-primary">
          FOCUSED
        </span>
      ) : null}
      <button
        type="button"
        onClick={copyAnchor}
        aria-label={`Copy deep link to the ${dept?.name ?? deptId} stats card`}
        title="copy deep link"
        className="absolute right-2.5 top-2.5 inline-flex h-6 w-6 items-center justify-center border border-transparent text-muted-foreground/40 opacity-0 transition-all hover:border-border hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Link2 className="h-3 w-3" aria-hidden="true" />
      </button>
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-mono text-xs font-bold tracking-wider text-foreground">
          <span className="text-primary">d</span> {dept?.dir ?? deptId}/
        </p>
        <p className="font-mono text-[10px] tabular-nums text-muted-foreground">
          {String(deptTotal).padStart(2, "0")} apps · {share.toFixed(0)}% share
        </p>
      </div>
      <div
        className="mt-3 flex h-3 w-full overflow-hidden bg-secondary/50"
        role="img"
        aria-label={`${dept?.name ?? deptId}: ${Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([k, v]) => `${STATUS_META[k as ApplicationStatus]?.label ?? k} ${v}`)
          .join(", ") || "no applications yet"}`}
      >
        {Object.entries(counts)
          .filter(([, v]) => v > 0)
          .map(([status, v]) => (
            <div
              key={status}
              className={cn("h-full transition-all duration-700", STATUS_META[status as ApplicationStatus]?.barClass ?? "bg-primary")}
              style={{ width: `${(v / Math.max(1, deptTotal)) * 100}%` }}
              title={`${STATUS_META[status as ApplicationStatus]?.label ?? status}: ${v}`}
            />
          ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {Object.entries(counts)
          .filter(([, v]) => v > 0)
          .sort((a, b) => b[1] - a[1])
          .map(([status, v]) => (
            <span
              key={status}
              className="flex items-center gap-1 text-[9px] tracking-widest text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className={cn("h-1.5 w-1.5", STATUS_META[status as ApplicationStatus]?.barClass ?? "bg-primary")}
              />
              {STATUS_META[status as ApplicationStatus]?.label ?? status}·{v}
            </span>
          ))}
        {deptTotal === 0 ? (
          <span className="text-[9px] tracking-widest text-muted-foreground/60">
            empty — be the first
          </span>
        ) : null}
      </div>
    </div>
  );
}

const SPARK_GLYPHS = ["\u2581", "\u2582", "\u2583", "\u2584", "\u2585", "\u2586", "\u2587", "\u2588"];

const pad2 = (n: number) => String(n).padStart(2, "0");

/** Week-over-week submission delta: trailing 7d vs the 7d before it. */
function wowDelta(timeline: DriveStats["timeline"]): number {
  const last7 = timeline.slice(-7).reduce((a, t) => a + t.count, 0);
  const prev7 = timeline.slice(-14, -7).reduce((a, t) => a + t.count, 0);
  return last7 - prev7;
}

/** sparkline glyph string for a timeline (shareable in plain text) */
function sparkString(timeline: DriveStats["timeline"]): string {
  const max = Math.max(1, ...timeline.map((t) => t.count));
  return timeline
    .map((t) => SPARK_GLYPHS[Math.round((t.count / max) * (SPARK_GLYPHS.length - 1))])
    .join("");
}

/** Build the clipboard-ready, PII-free funnel brief for group chats. */
function buildBrief(opts: {
  stats: DriveStats;
  open: boolean;
  deptFilter: string;
  scopedDeptDir: string | null;
  total: number;
  last24hCount: number;
  activeDomains: number;
  acceptRate: number;
  funnel: { stage: string; count: number }[];
  timeline: DriveStats["timeline"];
  deptTotals: { dir: string; total: number }[];
}): string {
  const {
    open,
    deptFilter,
    scopedDeptDir,
    total,
    last24hCount,
    activeDomains,
    acceptRate,
    funnel,
    timeline,
    deptTotals,
  } = opts;

  const tLeft = DRIVE_DEADLINE.getTime() - Date.now();
  const tMinus = tLeft > 0 ? `T-${Math.floor(tLeft / 86_400_000)}d` : "WINDOW.SHUT";
  const wow = wowDelta(timeline);
  const wowTxt = wow > 0 ? `+${wow} WoW` : wow < 0 ? `${wow} WoW` : "flat WoW";
  const peak =
    timeline.length > 0
      ? timeline.reduce((best, t) => (t.count > best.count ? t : best))
      : null;
  const peakTxt =
    peak && peak.count > 0
      ? `peak ${new Date(`${peak.date}T00:00:00+05:30`).toLocaleDateString("en-IN", {
          timeZone: "Asia/Kolkata",
          day: "2-digit",
          month: "short",
        })} (${peak.count})`
      : "no peak yet";

  const lines: string[] = [];
  lines.push(
    `\u25c8 NEXUS RECRUITMENTS '26 — LIVE FUNNEL · ${deptFilter ? `d ${scopedDeptDir}/` : "ALL DOMAINS"} · no PII`
  );
  lines.push(
    `  drive ${open ? "OPEN" : "CLOSED"} · closes 24 Sep 2026 23:59 IST · ${tMinus}`
  );
  lines.push(
    `  total ${pad2(total)} · +${pad2(last24hCount)} last 24h · ${activeDomains}/${
      deptFilter ? 1 : DEPARTMENTS.length
    } domains active · acceptance ${acceptRate}%`
  );
  lines.push(
    `  funnel: ${funnel.map(({ stage, count }) => `${stage} ${count}`).join(" → ")}`
  );
  lines.push(
    `  velocity ${sparkString(timeline)} (14d) · ${peakTxt} · ${wowTxt}`
  );
  if (!deptFilter && deptTotals.length) {
    lines.push(`  domains: ${deptTotals.map((d) => `${d.dir} ${pad2(d.total)}`).join(" · ")}`);
  }
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  lines.push(`  \u2192 ${origin}/stats${deptFilter ? `?dept=${deptFilter}` : ""}`);
  return lines.join("\n");
}

/** Domain scope chip for the /stats filter row. */
function ScopeChip({
  active,
  onClick,
  label,
  title,
  dotClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title: string;
  dotClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 border px-2.5 font-mono text-[10px] tracking-widest transition-all",
        active
          ? "border-primary/60 bg-primary/10 text-primary shadow-[0_0_18px_rgba(96,165,250,0.15)]"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {dotClass ? (
        <span aria-hidden="true" className={cn("h-1.5 w-1.5", dotClass)} />
      ) : null}
      {label}
    </button>
  );
}

/** Day-by-day submission velocity — block-glyph sparkline (desktop) / CSS bars (mobile). */
function SubmissionSparkline({
  timeline,
  scope,
}: {
  timeline: DriveStats["timeline"];
  scope: string | null;
}) {
  const max = Math.max(1, ...timeline.map((t) => t.count));
  const windowTotal = timeline.reduce((a, t) => a + t.count, 0);
  const peak =
    timeline.length > 0
      ? timeline.reduce((best, t) => (t.count > best.count ? t : best))
      : null;
  const hasData = windowTotal > 0;

  const fmtDay = (iso: string) => {
    const d = new Date(`${iso}T00:00:00+05:30`);
    return d.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "2-digit",
      month: "short",
    });
  };

  const firstLabel = timeline.length > 0 ? fmtDay(timeline[0].date) : "—";
  const lastLabel = timeline.length > 0 ? fmtDay(timeline[timeline.length - 1].date) : "—";
  const wow = wowDelta(timeline);
  const wowLabel =
    wow > 0 ? `\u25b2 +${wow} / 7d` : wow < 0 ? `\u25bc ${wow} / 7d` : "\u00b7 flat / 7d";

  return (
    <section
      className="border border-border bg-card p-4"
      aria-label="Submission velocity over the trailing 14 days"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
          $ plot --submissions · {scope ? `d ${scope}/` : "all domains"} · trailing 14d ·
          IST days
        </p>
        <p className="flex items-center gap-2 font-mono text-[10px] tabular-nums text-muted-foreground">
          <span
            title="week-over-week: trailing 7 days vs the 7 before"
            className={cn(
              "border px-1.5 py-px text-[9px] tracking-widest",
              wow > 0
                ? "border-ok/40 bg-ok/10 text-ok"
                : wow < 0
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground"
            )}
          >
            {wowLabel}
          </span>
          <span>
            <span className="text-foreground">Σ {String(windowTotal).padStart(2, "0")}</span>
            {peak && peak.count > 0 ? ` · peak ${fmtDay(peak.date)} (${peak.count})` : ""}
          </span>
        </p>
      </div>

      <div
        role="img"
        aria-label={`Submissions per day, ${firstLabel} to ${lastLabel}: ${windowTotal} total, busiest day ${
          peak && peak.count > 0 ? `${fmtDay(peak.date)} with ${peak.count}` : "none"
        }`}
        className="mt-4"
      >
        {/* desktop: one hoverable block glyph per day */}
        <pre
          aria-hidden="true"
          className="select-none overflow-x-auto whitespace-nowrap font-mono text-xl leading-none tracking-[0.18em] sm:text-2xl"
        >
          {timeline.map((t) => {
            const idx = Math.round((t.count / max) * (SPARK_GLYPHS.length - 1));
            const isPeak = peak !== null && t.date === peak.date && t.count > 0;
            return (
              <span
                key={t.date}
                title={`${fmtDay(t.date)} · ${t.count} submission${t.count === 1 ? "" : "s"}`}
                className={cn(
                  "spark-glyph transition-all",
                  isPeak
                    ? "text-ok ok-text"
                    : t.count > 0
                      ? "text-primary glow-soft"
                      : "text-border",
                  t.count > 0 && t.count < max && "opacity-80"
                )}
              >
                {SPARK_GLYPHS[idx]}
              </span>
            );
          })}
        </pre>

        {/* mobile: CSS bars (block glyphs render too small on phones) */}
        <div className="flex h-16 items-end gap-[3px] sm:hidden" aria-hidden="true">
          {timeline.map((t) => (
            <div
              key={t.date}
              className={cn(
                "flex-1 transition-all duration-700",
                t.count > 0 ? "bg-primary/80" : "bg-border/50"
              )}
              style={{ height: `${Math.max(4, (t.count / max) * 100)}%` }}
            />
          ))}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-2.5 font-mono text-[9px] tabular-nums text-muted-foreground/70">
        <span>{firstLabel}</span>
        <span className="hidden sm:inline">hover a glyph for the day count</span>
        <span>
          {lastLabel}
          {hasData ? " · today →" : " · flat — share the form!"}
        </span>
      </div>
    </section>
  );
}

export function StatsView() {
  const open = useDriveOpen();
  const [stats, setStats] = useState<DriveStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [deptFilter, setDeptFilter] = useState<string>("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/stats", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as DriveStats;
      // rAF-defer so the state swap never happens inside the fetch microtask
      requestAnimationFrame(() => {
        setStats(data);
        setUpdatedAt(
          new Date(data.generatedAt).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
          })
        );
      });
    } catch {
      // keep last good payload on transient failures
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => load(true), REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  /** restore (and keep in sync with) a shared ?dept= scope */
  useEffect(() => {
    const read = () => {
      const d = new URLSearchParams(window.location.search).get("dept");
      setDeptFilter(d && DEPARTMENTS.some((x) => x.id === d) ? d : "");
    };
    read();
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, []);

  const applyFilter = useCallback((d: string) => {
    setDeptFilter(d);
    const url = new URL(window.location.href);
    if (d) url.searchParams.set("dept", d);
    else url.searchParams.delete("dept");
    window.history.replaceState(null, "", url);
  }, []);

  /** overall funnel: stage → count, scoped to the active domain filter */
  const funnel = useMemo(() => {
    const byDept = stats?.byDepartmentStatus ?? {};
    const stages = STATUS_PIPELINE.map((stage) => {
      let count = 0;
      if (deptFilter) {
        const bucket = byDept[deptFilter] ?? {};
        if (stage === "DECISION") {
          for (const s of TERMINAL_STATUSES) count += bucket[s] ?? 0;
        } else {
          count = bucket[stage] ?? 0;
        }
      } else if (stage === "DECISION") {
        for (const s of TERMINAL_STATUSES)
          for (const bucket of Object.values(byDept)) count += bucket[s] ?? 0;
      } else {
        for (const bucket of Object.values(byDept)) count += bucket[stage] ?? 0;
      }
      return { stage, count };
    });
    return stages;
  }, [stats, deptFilter]);

  const statusBoard = useMemo(() => {
    const board: Record<string, number> = {};
    if (deptFilter) {
      for (const [status, v] of Object.entries(
        stats?.byDepartmentStatus?.[deptFilter] ?? {}
      )) {
        board[status] = (board[status] ?? 0) + v;
      }
    } else {
      for (const bucket of Object.values(stats?.byDepartmentStatus ?? {})) {
        for (const [status, v] of Object.entries(bucket)) {
          board[status] = (board[status] ?? 0) + v;
        }
      }
    }
    return board;
  }, [stats, deptFilter]);

  const allTotal = stats?.total ?? 0;
  const scopedBucket = deptFilter ? (stats?.byDepartmentStatus?.[deptFilter] ?? {}) : null;
  const total =
    scopedBucket !== null
      ? Object.values(scopedBucket).reduce((a, b) => a + b, 0)
      : allTotal;
  const accepted = statusBoard["ACCEPTED"] ?? 0;
  const acceptRate = total > 0 ? Math.round((accepted / total) * 100) : 0;
  const activeDomains =
    scopedBucket !== null
      ? total > 0
        ? 1
        : 0
      : Object.entries(stats?.byDepartment ?? {}).filter(([, v]) => v > 0).length;
  const last24hCount =
    scopedBucket !== null
      ? (stats?.timelineByDept?.[deptFilter]?.at(-1)?.count ?? 0)
      : (stats?.last24h ?? 0);

  const cohort = useMemo(() => {
    const entries = Object.entries(stats?.byJoinYear ?? {})
      .map(([year, count]) => ({ year, count }))
      .sort((a, b) => a.year.localeCompare(b.year));
    return entries;
  }, [stats]);

  const cohortMax = Math.max(1, ...cohort.map((c) => c.count));

  /** sparkline series for the active scope (zeros when the domain is empty) */
  const scopedTimeline = useMemo(() => {
    if (!deptFilter) return stats?.timeline ?? [];
    return (
      stats?.timelineByDept?.[deptFilter] ??
      (stats?.timeline ?? []).map((t) => ({ date: t.date, count: 0 }))
    );
  }, [stats, deptFilter]);
  const scopedDeptDir = deptFilter ? (getDepartment(deptFilter)?.dir ?? deptFilter) : null;

  /** per-department totals for the shareable brief (drive-wide only) */
  const deptTotals = useMemo(
    () =>
      DEPARTMENTS.map((d) => ({
        dir: d.dir,
        total: Object.values(stats?.byDepartmentStatus?.[d.id] ?? {}).reduce(
          (a, b) => a + b,
          0
        ),
      })),
    [stats]
  );

  const brief = useMemo(() => {
    if (!stats) return null;
    return buildBrief({
      stats,
      open,
      deptFilter,
      scopedDeptDir,
      total,
      last24hCount,
      activeDomains,
      acceptRate,
      funnel,
      timeline: scopedTimeline,
      deptTotals,
    });
  }, [
    stats,
    open,
    deptFilter,
    scopedDeptDir,
    total,
    last24hCount,
    activeDomains,
    acceptRate,
    funnel,
    scopedTimeline,
    deptTotals,
  ]);

  const copyBrief = useCallback(() => {
    if (!brief) return;
    navigator.clipboard
      ?.writeText(brief)
      .then(() =>
        toast.success("BRIEF_COPIED", {
          description: "plain-text funnel brief — paste it in the group chat.",
        })
      )
      .catch(() => toast.error("CLIPBOARD_BLOCKED", { description: "brief could not be copied" }));
  }, [brief]);

  return (
    <div className="mx-auto w-full max-w-6xl px-3 py-10 sm:px-6 sm:py-14">
      {/* terminal header */}
      <div className="terminal-panel">
        <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
          <p className="font-mono text-xs text-muted-foreground">
            nexus@vitc:~/recruitments
          </p>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
          <h1 className="font-mono text-lg font-bold tracking-tight sm:text-xl">
            <span className="text-primary glow-text">$</span> tail --stats --live
            <span className="text-muted-foreground"> --no-pii</span>
          </h1>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest text-ok">
              <span className="status-dot" aria-hidden="true" />
              LIVE · auto-refresh 20s
            </span>
            <button
              type="button"
              onClick={copyBrief}
              disabled={!brief}
              title="copy a plain-text, PII-free funnel brief for group chats"
              className="inline-flex h-8 items-center gap-1.5 border border-border px-3 font-mono text-[10px] font-bold tracking-widest text-muted-foreground transition-all hover:border-primary/50 hover:text-primary hover:shadow-[0_0_16px_rgba(96,165,250,0.15)] disabled:opacity-50"
            >
              <ClipboardCopy className="h-3 w-3" aria-hidden="true" />
              COPY.BRIEF
            </button>
            <button
              type="button"
              onClick={() => load()}
              disabled={refreshing}
              className="inline-flex h-8 items-center gap-1.5 border border-border px-3 font-mono text-[10px] font-bold tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-3 w-3", refreshing && "animate-spin")}
                aria-hidden="true"
              />
              {refreshing ? "SCANNING…" : "RESCAN"}
            </button>
          </div>
        </div>
      </div>

      {/* domain scope chips */}
      <div
        className="mt-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter statistics by domain"
      >
        <span className="mr-1 font-mono text-[9px] tracking-[0.25em] text-muted-foreground">
          $ grep --domain
        </span>
        <ScopeChip
          active={!deptFilter}
          onClick={() => applyFilter("")}
          label="ALL"
          title="show the whole drive"
        />
        {DEPARTMENTS.map((d) => (
          <ScopeChip
            key={d.id}
            active={deptFilter === d.id}
            onClick={() => applyFilter(d.id)}
            label={`d ${d.dir}/`}
            title={`focus ${d.name}`}
            dotClass={DEPT_BAR_COLORS[d.id]}
          />
        ))}
      </div>

      {loading && !stats ? (
        <div className="mt-6 border border-border bg-card p-8 text-center font-mono text-xs text-muted-foreground">
          reading /var/stats/drive.log<span className="animate-pulse">▊</span>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCell
              icon={<Layers className="h-3 w-3" aria-hidden="true" />}
              label={deptFilter ? `TOTAL · D ${scopedDeptDir?.toUpperCase()}/` : "TOTAL APPLICATIONS"}
              value={total}
              accent="text-primary glow-text"
              hint={deptFilter ? `applications in d ${scopedDeptDir}/` : "every transmission received this drive"}
            />
            <KpiCell
              icon={<TrendingUp className="h-3 w-3" aria-hidden="true" />}
              label="LAST 24 HOURS"
              value={last24hCount}
              accent="text-emerald-400"
              hint="applications submitted in the trailing 24h — drive velocity"
            />
            <KpiCell
              icon={<Activity className="h-3 w-3" aria-hidden="true" />}
              label="DOMAINS ACTIVE"
              value={activeDomains}
              accent="text-amber-400"
              hint="domains with at least one application"
            />
            <KpiCell
              icon={<CheckCircle2 className="h-3 w-3" aria-hidden="true" />}
              label="ACCEPTANCE"
              value={acceptRate}
              suffix="%"
              accent="text-fuchsia-400"
              hint={`${accepted} accepted of ${total} — decisions so far`}
            />
          </div>

          {/* funnel + status board */}
          <div className="mt-6 grid gap-6 lg:grid-cols-5">
            <section
              className="border border-border bg-card p-4 lg:col-span-3"
              aria-label="Review pipeline funnel"
            >
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                <Users className="h-3 w-3" aria-hidden="true" />
                $ awk --funnel · review pipeline ·{" "}
                {deptFilter ? `d ${scopedDeptDir}/ only` : "all domains"}
              </p>
              <ol className="mt-4 space-y-3.5">
                {funnel.map(({ stage, count }) => {
                  const meta = STATUS_META[stage as ApplicationStatus];
                  return (
                    <StageBar
                      key={stage}
                      label={
                        stage === "DECISION"
                          ? "DECISION (accepted + waitlist + rejected)"
                          : meta?.label ?? stage
                      }
                      count={count}
                      total={Math.max(1, total)}
                      barClass={
                        stage === "DECISION"
                          ? "bg-primary"
                          : meta?.barClass ?? "bg-primary"
                      }
                    />
                  );
                })}
              </ol>
              <p className="mt-4 border-t border-border/60 pt-3 text-[9px] leading-relaxed text-muted-foreground/70">
                stages overlap by design — an application sits in exactly one status,
                the funnel shows where the collective's attention is right now.
              </p>
            </section>

            {/* status board */}
            <section
              className="border border-border bg-card p-4 lg:col-span-2"
              aria-label="Status distribution"
            >
              <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                $ sort --status · {deptFilter ? `d ${scopedDeptDir}/` : "all statuses"}
              </p>
              <ul className="mt-4 grid grid-cols-2 gap-2">
                {Object.entries(statusBoard)
                  .sort((a, b) => b[1] - a[1])
                  .map(([status, count]) => {
                    const meta = STATUS_META[status as ApplicationStatus] ?? STATUS_META.SUBMITTED;
                    return (
                      <li
                        key={status}
                        className={cn(
                          "border px-2.5 py-2",
                          meta.chipClass
                        )}
                      >
                        <p className="font-mono text-lg font-bold tabular-nums leading-none">
                          {String(count).padStart(2, "0")}
                        </p>
                        <p className="mt-1 text-[8px] tracking-widest">{meta.label}</p>
                      </li>
                    );
                  })}
                {Object.keys(statusBoard).length === 0 ? (
                  <li className="col-span-2 border border-border px-2.5 py-3 text-center text-[10px] tracking-widest text-muted-foreground/60">
                    no statuses yet
                  </li>
                ) : null}
              </ul>
              <p className="mt-4 border-t border-border/60 pt-3 text-[9px] leading-relaxed text-muted-foreground/70">
                {open ? (
                  <>
                    drive is <span className="text-primary">OPEN</span> — counts move as
                    the core team reviews.{" "}
                  </>
                ) : (
                  <>
                    drive is <span className="text-destructive">CLOSED</span> — these are
                    the final numbers for this cycle.{" "}
                  </>
                )}
                refreshed every {REFRESH_MS / 1000}s
                {updatedAt ? ` · last ${updatedAt} IST` : ""}
              </p>
            </section>
          </div>

          {/* per-department stacked bars */}
          <section className="mt-6" aria-label="Per-department pipeline">
            <p className="flex flex-wrap items-baseline gap-x-3 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
              <span>$ split --domains · stacked by review status</span>
              {deptFilter ? (
                <span className="font-mono text-[9px] normal-case tracking-widest text-primary">
                  focused: d {scopedDeptDir}/ · pick ALL to reset
                </span>
              ) : null}
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {DEPARTMENTS.map((d) => (
                <DeptStack
                  key={d.id}
                  deptId={d.id}
                  counts={stats?.byDepartmentStatus?.[d.id] ?? {}}
                  total={allTotal}
                  focused={deptFilter === d.id}
                />
              ))}
            </div>
          </section>

          {/* submission velocity */}
          {scopedTimeline.length ? (
            <div className="mt-6">
              <SubmissionSparkline timeline={scopedTimeline} scope={scopedDeptDir} />
            </div>
          ) : null}

          {/* cohort mix — drive-wide aggregate, so only meaningful unscoped */}
          {!deptFilter && cohort.length > 0 ? (
            <section className="mt-6" aria-label="Cohort mix by joining year">
              <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                $ group --cohort · applicants by joining year
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {cohort.map(({ year, count }) => (
                  <li
                    key={year}
                    className="border border-border bg-card p-3"
                    role="meter"
                    aria-valuenow={count}
                    aria-valuemin={0}
                    aria-valuemax={cohortMax}
                    aria-label={`${count} applicants from ${year} cohort`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="font-mono text-xs font-bold text-foreground">
                        2K{year.slice(2)}
                      </span>
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {String(count).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full bg-secondary/60" aria-hidden="true">
                      <div
                        className={cn(
                          "h-full transition-all duration-700",
                          DEPT_BAR_COLORS.webdev
                        )}
                        style={{ width: `${(count / cohortMax) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* privacy footnote */}
          <p className="mt-8 border border-border/60 bg-secondary/20 px-4 py-3 text-[9px] leading-relaxed text-muted-foreground/70">
            privacy: this page renders aggregates only — no names, emails or answers
            ever leave the review console. the same numbers the core team sees, minus
            the people.
            {deptFilter ? " cohort mix is a drive-wide aggregate — it hides while a domain is focused." : ""}
          </p>
        </>
      )}
    </div>
  );
}
