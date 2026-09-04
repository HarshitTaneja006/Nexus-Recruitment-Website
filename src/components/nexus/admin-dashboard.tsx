"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  RefreshCw,
  Search,
  Inbox,
  ExternalLink,
  X,
  Mail,
  CalendarDays,
  CalendarClock,
  ShieldCheck,
  History,
  BellRing,
  Files,
  Send,
  ChevronsLeft,
  ChevronsRight,
  HelpCircle,
  TriangleAlert,
  Copy,
  MessageCircle,
  Lock,
  Unlock,
  MailPlus,
  KeyRound,
  CheckSquare,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import {
  COMMON_QUESTIONS,
  DEPARTMENTS,
  getDepartment,
  LEGACY_QUESTION_LABELS,
  type Links,
} from "@/lib/departments";
import {
  APPLICATION_STATUSES,
  INTERVIEW_MODES,
  INTERVIEW_MODE_META,
  getStatusMeta,
  isInterviewMode,
  isTerminalStatus,
  parseStatusHistory,
} from "@/lib/status";
import type { ApplicationRecord, DriveStats, NotificationRecord } from "@/lib/storage";
import { formatYearOfStudy } from "@/lib/vit";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type SortKey = "newest" | "oldest" | "name";
type ConsoleTab = "applications" | "agenda" | "outbox";

const PAGE_SIZE = 25;

interface AdminPayload {
  applications: ApplicationRecord[];
  stats: DriveStats;
}

/** one row of the SLOT_CONFLICT 409 payload */
interface SlotConflict {
  id: string;
  fullName: string;
  department: string;
  interviewAt: string;
  interviewMode: string | null;
}

const DEPT_COLORS: Record<string, string> = {
  technical: "bg-sky-400",
  management: "bg-amber-400",
  design_social_media: "bg-fuchsia-400",
};

/* ---- interview slot ↔ IST helpers (the drive runs on IST) ---- */

function isoToIstParts(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "", time: "" };
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }), // YYYY-MM-DD
    time: d.toLocaleTimeString("en-GB", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }),
  };
}

function istPartsToIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function AdminDashboard() {
  const [tab, setTab] = useState<ConsoleTab>("applications");
  const [data, setData] = useState<AdminPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [department, setDepartment] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [order, setOrder] = useState<SortKey>("newest");
  const [selected, setSelected] = useState<ApplicationRecord | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [composerOpen, setComposerOpen] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchApps = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const params = new URLSearchParams();
        if (department) params.set("department", department);
        if (status) params.set("status", status);
        if (debouncedQuery) params.set("q", debouncedQuery);
        if (order !== "newest") params.set("order", order);
        const res = await fetch(`/api/admin/applications?${params}`, {
          cache: "no-store",
        });
        if (res.status === 403) {
          toast.error("Access revoked - refresh the page to re-authenticate.");
          return;
        }
        if (!res.ok) {
          throw new Error(`API ${res.status}`);
        }
        const payload = (await res.json()) as AdminPayload;
        setData(payload);
      } catch {
        if (!silent) toast.error("Failed to load applications");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [department, status, debouncedQuery, order]
  );

  useEffect(() => {
    fetchApps();
  }, [fetchApps]);

  // debounce search input
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query]);

  // any filter/order change sends the reader back to page one
  useEffect(() => {
    setPage(0);
  }, [department, status, debouncedQuery, order]);

  // auto-refresh every 30s
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => fetchApps(true), 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchApps]);

  const maxDept = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, ...Object.values(data.stats.byDepartment));
  }, [data]);

  /** files currently SHORTLISTED - badge for the AGENDA tab (slots live here) */
  const interviewCount = useMemo(() => {
    if (!data) return 0;
    let n = 0;
    for (const bucket of Object.values(data.stats.byDepartmentStatus))
      n += bucket["SHORTLISTED"] ?? 0;
    return n;
  }, [data]);

  const apps = data?.applications ?? [];
  const pageCount = Math.max(1, Math.ceil(apps.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => apps.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE),
    [apps, safePage]
  );

  /** selection limited to rows actually on screen (filters/page changes reset it) */
  const pageSelected = useMemo(
    () => pageRows.filter((a) => selectedIds.includes(a.id)),
    [pageRows, selectedIds]
  );
  const toggleSelected = useCallback((id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);
  const allPageSelected = pageRows.length > 0 && pageRows.every((a) => selectedIds.includes(a.id));
  const toggleAllPage = () =>
    setSelectedIds(allPageSelected ? [] : pageRows.map((a) => a.id));

  // keep the selection honest when the filter/page changes
  useEffect(() => {
    setSelectedIds((prev) => prev.filter((id) => apps.some((a) => a.id === id)));
  }, [department, status, debouncedQuery, order, safePage]);

  /** Optimistically patch one application across every copy we hold. */
  const patchApplication = useCallback((updated: ApplicationRecord) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            applications: prev.applications.map((a) =>
              a.id === updated.id ? updated : a
            ),
          }
        : prev
    );
    setSelected((prev) => (prev && prev.id === updated.id ? updated : prev));
  }, []);

  const deptLabel = (id: string) => getDepartment(id)?.name ?? id;

  const exportHref = useMemo(() => {
    const params = new URLSearchParams();
    if (department) params.set("department", department);
    if (status) params.set("status", status);
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (order !== "newest") params.set("order", order);
    const qs = params.toString();
    return `/api/admin/applications/export${qs ? `?${qs}` : ""}`;
  }, [department, status, debouncedQuery, order]);

  // "/" anywhere in the console jumps to the grep box
  const searchRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        !(e.target instanceof HTMLInputElement) &&
        !(e.target instanceof HTMLTextAreaElement) &&
        !(e.target instanceof HTMLSelectElement)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      {/* header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="section-tag self-start">
            <span className="text-primary">CORE</span>
            <span className="text-muted-foreground">/</span> REVIEW_CONSOLE
          </p>
          <h1 className="mt-3 font-mono text-2xl font-bold tracking-tight">
            $ review --applications
          </h1>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            every transmission lands here · auto-scan {autoRefresh ? "ON (30s)" : "OFF"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatsAccessToggle />
          <button
            type="button"
            onClick={() => setComposerOpen(true)}
            disabled={selectedIds.length === 0}
            title="Compose a custom email to the selected applicants"
            className={cn(
              "inline-flex h-9 items-center gap-2 border px-3 font-mono text-[10px] tracking-widest transition-colors",
              selectedIds.length > 0
                ? "border-fuchsia-400/60 bg-fuchsia-400/10 text-fuchsia-300 hover:bg-fuchsia-400 hover:text-[#05080d]"
                : "cursor-not-allowed border-border text-muted-foreground/50"
            )}
          >
            <MailPlus className="h-3.5 w-3.5" aria-hidden="true" />
            EMAIL ({selectedIds.length})
          </button>
          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            aria-pressed={autoRefresh}
            className={cn(
              "inline-flex h-9 items-center gap-2 border px-3 font-mono text-[10px] tracking-widest transition-colors",
              autoRefresh
                ? "border-ok/50 bg-ok/10 text-ok"
                : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            <span
              className={cn(
                "inline-block h-1.5 w-1.5 rounded-full",
                autoRefresh ? "bg-ok" : "bg-muted-foreground"
              )}
              aria-hidden="true"
            />
            AUTO
          </button>
          <button
            type="button"
            onClick={() => fetchApps()}
            className="inline-flex h-9 items-center gap-2 border border-border px-3 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <RefreshCw
              className={cn("h-3.5 w-3.5", refreshing && "animate-spin")}
              aria-hidden="true"
            />
            RESCAN
          </button>
          <a
            href={exportHref}
            className="inline-flex h-9 items-center gap-2 border border-primary/50 bg-primary/10 px-3 font-mono text-[10px] tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            EXPORT_CSV
          </a>
        </div>
      </div>

      <OpsDayStrip onOpen={setSelected} />

      {/* console tabs: applications | outbox */}
      <div
        role="tablist"
        aria-label="Console sections"
        className="mt-6 flex border border-border bg-secondary/30"
      >
        <ConsoleTabButton
          active={tab === "applications"}
          onClick={() => setTab("applications")}
          icon={<Files className="h-3.5 w-3.5" aria-hidden="true" />}
          label="APPLICATIONS"
          count={data?.stats.total}
        />
        <ConsoleTabButton
          active={tab === "agenda"}
          onClick={() => setTab("agenda")}
          icon={<CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />}
          label="AGENDA"
          count={interviewCount}
        />
        <ConsoleTabButton
          active={tab === "outbox"}
          onClick={() => setTab("outbox")}
          icon={<BellRing className="h-3.5 w-3.5" aria-hidden="true" />}
          label="OUTBOX"
          pending
        />
      </div>

      {tab === "applications" ? (
        <>
      {/* stats + per-department visualization */}
      <section className="terminal-panel mt-4" aria-label="Drive statistics">
        <div className="border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ stats --live
          </span>
        </div>
        <div className="grid gap-6 p-4 md:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-6">
            <div>
              <p className="font-mono text-4xl font-bold text-primary tabular-nums">
                {loading ? "-" : data?.stats.total ?? 0}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                total applications
              </p>
            </div>
          </div>
          <div>
            <ul className="space-y-2" aria-label="Applications per department">
              {DEPARTMENTS.map((d) => {
                const count = data?.stats.byDepartment[d.id] ?? 0;
                const statusCounts = data?.stats.byDepartmentStatus?.[d.id] ?? {};
                return (
                  <li key={d.id} className="flex items-center gap-3">
                    <span className="w-36 shrink-0 truncate font-mono text-[11px] text-muted-foreground">
                      d {d.dir}/
                    </span>
                    <div
                      className="flex h-3.5 flex-1 overflow-hidden border border-border bg-muted"
                      role="meter"
                      aria-valuenow={count}
                      aria-valuemin={0}
                      aria-valuemax={maxDept}
                      aria-label={`${d.name}: ${count} applications`}
                      title={`${d.name}: ${count}`}
                    >
                      {count > 0 ? (
                        APPLICATION_STATUSES.map((s) => {
                          const n = statusCounts[s] ?? 0;
                          if (!n) return null;
                          const meta = getStatusMeta(s);
                          return (
                            <span
                              key={s}
                              className={cn("h-full transition-all duration-700", meta.barClass)}
                              style={{ width: `${(n / count) * 100}%` }}
                              title={`${meta.label}: ${n}`}
                            />
                          );
                        })
                      ) : null}
                    </div>
                    <span className="w-8 text-right font-mono text-xs tabular-nums text-foreground">
                      {count}
                    </span>
                  </li>
                );
              })}
            </ul>
            {/* pipeline legend */}
            <ul
              className="mt-3 flex flex-wrap gap-x-3 gap-y-1"
              aria-label="Pipeline status legend"
            >
              {APPLICATION_STATUSES.map((s) => {
                const meta = getStatusMeta(s);
                return (
                  <li
                    key={s}
                    className="flex items-center gap-1 font-mono text-[8px] tracking-[0.15em] text-muted-foreground/70"
                  >
                    <span
                      className={cn("h-1.5 w-1.5 rounded-sm", meta.barClass)}
                      aria-hidden="true"
                    />
                    {meta.label}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>

      {/* filters */}
      <section className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between" aria-label="Filters">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Department filter">
          <FilterChip active={!department} onClick={() => setDepartment("")} label="ALL" />
          {DEPARTMENTS.map((d) => (
            <FilterChip
              key={d.id}
              active={department === d.id}
              onClick={() => setDepartment(department === d.id ? "" : d.id)}
              label={`d ${d.dir}/`}
            />
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-64 lg:flex-none">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="grep name / email…  ( / )"
              aria-label="Search applications by name or email - press slash to focus"
              className="h-9 w-full border border-input bg-background/80 pl-8 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
            />
          </div>
          <select
            value={order}
            onChange={(e) => setOrder(e.target.value as SortKey)}
            aria-label="Sort order"
            className="h-9 border border-input bg-background/80 px-2 font-mono text-[11px] text-foreground focus:border-primary focus:outline-none"
          >
            <option value="newest">NEWEST</option>
            <option value="oldest">OLDEST</option>
            <option value="name">A–Z</option>
          </select>
        </div>
      </section>

      {/* status filter row */}
      <section
        className="mt-2 flex flex-wrap items-center gap-1.5"
        role="group"
        aria-label="Status filter"
      >
        <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.25em] text-muted-foreground/60">
          status:
        </span>
        <FilterChip active={!status} onClick={() => setStatus("")} label="ANY" />
        {APPLICATION_STATUSES.map((s) => {
          const meta = getStatusMeta(s);
          const count = data?.applications.filter((a) => a.status === s).length ?? 0;
          return (
            <FilterChip
              key={s}
              active={status === s}
              onClick={() => setStatus(status === s ? "" : s)}
              label={meta.label}
              activeClass={meta.chipClass}
            />
          );
        })}
      </section>

      {/* results */}
      <section className="terminal-panel mt-4" aria-label="Applications">
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ ls --results · {loading ? "…" : apps.length} rows
            {apps.length > PAGE_SIZE ? ` · ${PAGE_SIZE}/page` : ""}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">
            click a row to open the full file
          </span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4" aria-busy="true">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse bg-secondary/40" />
            ))}
          </div>
        ) : apps.length === 0 ? (
          <div className="flex flex-col items-center gap-3 p-12 text-center">
            <Inbox className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
            <p className="font-mono text-xs text-muted-foreground">
              0 RESULTS - the pipe is quiet. Adjust filters or wait for transmissions.
            </p>
          </div>
        ) : (
          <>
            {/* desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left font-mono text-xs">
                <caption className="sr-only">
                  Submitted recruitment applications
                </caption>
                <thead>
                  <tr className="border-b border-border text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                    <th scope="col" className="w-8 px-3 py-2.5">
                      <button
                        type="button"
                        onClick={toggleAllPage}
                        aria-label={allPageSelected ? "Deselect all rows on this page" : "Select all rows on this page"}
                        title="select / clear page"
                        className="text-muted-foreground transition-colors hover:text-primary"
                      >
                        {allPageSelected ? (
                          <CheckSquare className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                        ) : (
                          <Square className="h-3.5 w-3.5" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th scope="col" className="px-4 py-2.5">#</th>
                    <th scope="col" className="px-4 py-2.5">NAME</th>
                    <th scope="col" className="px-4 py-2.5">EMAIL</th>
                    <th scope="col" className="px-4 py-2.5">YEAR</th>
                    <th scope="col" className="px-4 py-2.5">DEPARTMENT</th>
                    <th scope="col" className="px-4 py-2.5">STATUS</th>
                    <th scope="col" className="px-4 py-2.5">LINKS</th>
                    <th scope="col" className="px-4 py-2.5">SUBMITTED</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((app, i) => {
                    const dept = getDepartment(app.department);
                    const linkCount = Object.values(app.links ?? {}).filter(
                      (v) => v?.trim()
                    ).length;
                    const checked = selectedIds.includes(app.id);
                    return (
                      <tr
                        key={app.id}
                        tabIndex={0}
                        role="button"
                        onClick={() => setSelected(app)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelected(app);
                          }
                        }}
                        className={cn(
                          "cursor-pointer border-b border-border/60 transition-colors hover:bg-secondary/50 focus:bg-secondary/50 focus:outline-none",
                          checked && "bg-fuchsia-400/5"
                        )}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={checked}
                            aria-label={`Select ${app.fullName} for custom email`}
                            onClick={() => toggleSelected(app.id)}
                            className="text-muted-foreground transition-colors hover:text-primary"
                          >
                            {checked ? (
                              <CheckSquare className="h-3.5 w-3.5 text-fuchsia-300" aria-hidden="true" />
                            ) : (
                              <Square className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground/60 tabular-nums">
                          {String(safePage * PAGE_SIZE + i + 1).padStart(2, "0")}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-foreground">
                          {app.fullName}
                        </td>
                        <td className="max-w-[220px] truncate px-4 py-2.5 text-muted-foreground" title={app.email}>
                          {app.email}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {formatYearOfStudy(app.yearOfStudy)}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={cn("inline-flex items-center gap-1.5", dept?.accentClass)}>
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", DEPT_COLORS[app.department])}
                              aria-hidden="true"
                            />
                            {dept?.dir}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <StatusBadge status={app.status} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                          {linkCount > 0 ? `${linkCount} ↗` : "-"}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {new Date(app.submittedAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* mobile cards */}
            <ul className="divide-y divide-border md:hidden">
              {pageRows.map((app) => {
                const dept = getDepartment(app.department);
                const checked = selectedIds.includes(app.id);
                return (
                  <li key={app.id} className={cn(checked && "bg-fuchsia-400/5")}>
                    <div className="flex items-stretch">
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        aria-label={`Select ${app.fullName} for custom email`}
                        onClick={() => toggleSelected(app.id)}
                        className="flex w-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-primary"
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />
                        ) : (
                          <Square className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelected(app)}
                        className="min-w-0 flex-1 px-2 py-3 pr-4 text-left transition-colors hover:bg-secondary/50"
                      >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-sm font-semibold text-foreground">
                          {app.fullName}
                        </span>
                        <span className={cn("font-mono text-[10px]", dept?.accentClass)}>
                          d {dept?.dir}/
                        </span>
                      </div>
                      <div className="mt-1">
                        <StatusBadge status={app.status} />
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">
                        {app.email}
                      </p>
                      <p className="mt-1 font-mono text-[10px] text-muted-foreground/70">
                        {formatYearOfStudy(app.yearOfStudy)} ·{" "}
                        {new Date(app.submittedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                        })}
                      </p>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* pagination footer */}
            {pageCount > 1 ? (
              <nav
                aria-label="Result pages"
                className="flex items-center justify-between border-t border-border px-4 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors enabled:hover:border-primary/50 enabled:hover:text-primary disabled:opacity-40"
                >
                  <ChevronsLeft className="h-3.5 w-3.5" aria-hidden="true" /> PREV
                </button>
                <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground tabular-nums">
                  PAGE {String(safePage + 1).padStart(2, "0")} /{" "}
                  {String(pageCount).padStart(2, "0")}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                  disabled={safePage >= pageCount - 1}
                  className="inline-flex items-center gap-1.5 border border-border px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors enabled:hover:border-primary/50 enabled:hover:text-primary disabled:opacity-40"
                >
                  NEXT <ChevronsRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </nav>
            ) : null}
          </>
        )}
      </section>
        </>
      ) : tab === "agenda" ? (
        <AgendaPanel onOpen={setSelected} />
      ) : (
        <OutboxPanel />
      )}

      <DetailDialog
        application={selected}
        onUpdated={patchApplication}
        onClose={() => setSelected(null)}
      />

      <EmailComposer
        open={composerOpen}
        apps={pageSelected}
        onClose={() => setComposerOpen(false)}
        onQueued={(n) => {
          setSelectedIds([]);
          setComposerOpen(false);
          toast.success(`CUSTOM_MAIL_QUEUED · ${n}`, {
            description: "Rows in the outbox - FLUSH_QUEUE delivers via SMTP.",
          });
        }}
      />
    </div>
  );
}

function ConsoleTabButton({
  active,
  onClick,
  icon,
  label,
  count,
  pending,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  count?: number;
  pending?: boolean;
}) {
  const [queued, setQueued] = useState<number | null>(null);
  useEffect(() => {
    if (!pending) return;
    let alive = true;
    const load = () =>
      fetch("/api/admin/notifications", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { queued?: number } | null) => {
          if (alive && d && typeof d.queued === "number") setQueued(d.queued);
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [pending]);
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 px-2 py-2.5 font-mono text-[9px] tracking-[0.08em] transition-colors sm:flex-none sm:gap-2 sm:px-6 sm:text-[10px] sm:tracking-[0.2em]",
        active
          ? "border-b-2 border-primary bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {label}
      {pending ? (
        <span
          className={cn(
            "hidden border px-1.5 py-px text-[8px] tabular-nums sm:inline-block",
            queued
              ? "border-warn/50 bg-warn/10 text-warn"
              : "border-border text-muted-foreground/60"
          )}
        >
          {queued ?? "·"}
        </span>
      ) : typeof count === "number" ? (
        <span className="hidden border border-border px-1.5 py-px text-[8px] tabular-nums text-muted-foreground/60 sm:inline-block">
          {count}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Notification outbox - every review commit queues a student-facing email
 * here. FLUSH_QUEUE now calls the real drain worker
 * (POST /api/admin/notifications/drain): rows are claimed FIFO and delivered
 * via SMTP when SMTP_HOST is set (sandbox mode marks SENT without a
 * provider call). Failed rows keep the provider reason and can be RETRY'd
 * (re-queued) and drained again.
 */
function OutboxPanel() {
  const [items, setItems] = useState<NotificationRecord[] | null>(null);
  const [queued, setQueued] = useState(0);
  const [provider, setProvider] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/notifications", { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as {
        items: NotificationRecord[];
        queued: number;
        provider?: string;
      };
      setItems(d.items);
      setQueued(d.queued);
      setProvider(d.provider ?? null);
    } catch {
      toast.error("OUTBOX_OFFLINE", { description: "Could not load the notification queue." });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const markSent = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("CLAIMED_BY_WORKER", { description: "Row handed to the delivery worker." });
      await load();
    } catch {
      toast.error("CLAIM_FAILED");
    } finally {
      setBusyId(null);
    }
  };

  const flushAll = async () => {
    if (queued === 0 || busyId) return;
    setBusyId("__all");
    try {
      const res = await fetch("/api/admin/notifications/drain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as {
        provider: string;
        claimed: number;
        delivered: number;
        failed: Array<{ email: string; reason: string }>;
        queuedRemaining: number;
      };
      if (d.failed.length > 0) {
        toast.error(`DRAIN_PARTIAL · ${d.delivered} SENT / ${d.failed.length} FAILED`, {
          description: d.failed[0]?.reason.slice(0, 120) ?? "Provider rejected the delivery.",
        });
      } else {
        toast.success(`QUEUE_DRAINED · ${d.delivered} SENT`, {
          description:
            d.provider === "smtp"
              ? `SMTP delivery complete · ${d.queuedRemaining} left queued.`
              : `Sandbox delivery (set SMTP_HOST to go live) · ${d.queuedRemaining} left queued.`,
        });
      }
      await load();
    } catch {
      toast.error("FLUSH_FAILED");
    } finally {
      setBusyId(null);
    }
  };

  const requeue = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "requeue" }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success("RE_QUEUED", { description: "Row back in the queue - drain to retry delivery." });
      await load();
    } catch {
      toast.error("REQUEUE_FAILED");
    } finally {
      setBusyId(null);
    }
  };

  const remindDrafts = async () => {
    if (busyId) return;
    setBusyId("__remind");
    try {
      const res = await fetch("/api/admin/notifications/draft-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 423) {
        toast.warning("WINDOW_SHUT", { description: "The deadline has passed - nobody left to remind." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as {
        queued: number;
        candidates: number;
        deduped?: number;
        windowOpen?: boolean;
      };
      if (d.queued === 0) {
        toast.info("NO_ELIGIBLE_DRAFTS", {
          description: `${d.candidates} draft-only student(s) - all reminded within the last 48h.`,
        });
      } else {
        toast.success(`DRAFT_REMINDERS_QUEUED · ${d.queued}`, {
          description: `${d.candidates} draft-only student(s) found · ${d.queued} mail(s) in the queue - FLUSH_QUEUE to send.`,
        });
      }
      await load();
    } catch {
      toast.error("REMINDER_SWEEP_FAILED");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="terminal-panel mt-4" aria-label="Notification outbox">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          $ mailq --outbox · {items ? `${queued} queued / ${items.length} rows` : "…"}
          {provider ? (
            <span
              className={cn(
                "ml-2 border px-1 py-px text-[8px] tracking-widest",
                provider === "smtp"
                  ? "border-ok/50 bg-ok/10 text-ok"
                  : "border-border bg-secondary/60 text-muted-foreground"
              )}
              title={
                provider === "smtp"
                  ? "SMTP_HOST detected - FLUSH_QUEUE delivers real email"
                  : "No SMTP_HOST - FLUSH_QUEUE accepts the hand-off in sandbox mode"
              }
            >
              PROVIDER: {provider.toUpperCase()}
            </span>
          ) : null}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={remindDrafts}
            disabled={busyId === "__remind"}
            title="Queue deadline-near reminder mail for students with drafts but no submission"
            className="inline-flex h-7 items-center gap-1.5 border border-warn/50 bg-warn/10 px-2.5 font-mono text-[9px] tracking-widest text-warn transition-colors enabled:hover:bg-warn enabled:hover:text-[#05080d] disabled:opacity-40"
          >
            <BellRing className="h-3 w-3" aria-hidden="true" />
            {busyId === "__remind" ? "SWEEPING…" : "REMIND_DRAFTS"}
          </button>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-7 items-center gap-1.5 border border-border px-2.5 font-mono text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
          >
            <RefreshCw className="h-3 w-3" aria-hidden="true" /> RESCAN
          </button>
          <button
            type="button"
            onClick={flushAll}
            disabled={queued === 0 || busyId === "__all"}
            className="inline-flex h-7 items-center gap-1.5 border border-primary/50 bg-primary/10 px-2.5 font-mono text-[9px] tracking-widest text-primary transition-colors enabled:hover:bg-primary enabled:hover:text-primary-foreground disabled:opacity-40"
          >
            <Send className="h-3 w-3" aria-hidden="true" />
            {busyId === "__all" ? "FLUSHING…" : `FLUSH_QUEUE (${queued})`}
          </button>
        </div>
      </div>
      <p className="border-b border-border/60 bg-background/40 px-4 py-1.5 font-mono text-[9px] leading-relaxed text-muted-foreground/60">
        FLUSH_QUEUE runs the real drain: rows are claimed FIFO, delivered via SMTP when
        SMTP_HOST is set (sandbox mode otherwise), failures keep the provider reason →
        RETRY re-queues them. REMIND_DRAFTS sweeps draft-only students near the deadline (48h dedupe).
      </p>

      {!items ? (
        <div className="space-y-2 p-4" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse bg-secondary/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 p-12 text-center">
          <BellRing className="h-8 w-8 text-muted-foreground/50" aria-hidden="true" />
          <p className="font-mono text-xs text-muted-foreground">
            QUEUE EMPTY - commit a review action and the student email lands here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((n) => {
            const isQueued = n.status === "QUEUED";
            const isFailed = n.status === "FAILED";
            const open = expanded === n.id;
            return (
              <li key={n.id} className="px-4 py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px]">
                  <span className="text-muted-foreground/60 tabular-nums">
                    {new Date(n.createdAt).toLocaleString("en-IN", {
                      timeZone: "Asia/Kolkata",
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                      hour12: false,
                    })}
                  </span>
                  <span
                    className={cn(
                      "border px-1 py-px text-[8px] tracking-widest",
                      n.type === "SUBMISSION_RECEIPT"
                        ? "border-ok/50 bg-ok/10 text-ok"
                        : n.type === "DRAFT_REMINDER"
                          ? "border-warn/50 bg-warn/10 text-warn"
                          : n.type === "CUSTOM"
                            ? "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-300"
                            : "border-primary/50 bg-primary/10 text-primary"
                    )}
                  >
                    {n.type}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpanded(open ? null : n.id)}
                    aria-expanded={open}
                    className="min-w-0 max-w-[240px] truncate text-left text-foreground transition-colors hover:text-primary sm:max-w-[360px]"
                    title={n.subject}
                  >
                    {n.subject}
                  </button>
                  <span className="truncate text-muted-foreground" title={n.email}>
                    → {n.fullName} ({n.email.split("@")[0]})
                  </span>
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 border px-1.5 py-px text-[8px] tracking-widest",
                      isQueued
                        ? "border-warn/50 bg-warn/10 text-warn"
                        : isFailed
                          ? "border-destructive/50 bg-destructive/10 text-destructive"
                          : "border-ok/50 bg-ok/10 text-ok"
                    )}
                  >
                    <span
                      className={cn(
                        "h-1 w-1 rounded-full",
                        isQueued ? "animate-pulse bg-warn" : isFailed ? "bg-destructive" : "bg-ok"
                      )}
                      aria-hidden="true"
                    />
                    {n.status}
                  </span>
                  {isQueued ? (
                    <button
                      type="button"
                      onClick={() => markSent(n.id)}
                      disabled={busyId === n.id}
                      className="border border-border px-1.5 py-px text-[8px] tracking-widest text-muted-foreground transition-colors enabled:hover:border-primary/50 enabled:hover:text-primary"
                    >
                      {busyId === n.id ? "…" : "MARK_SENT"}
                    </button>
                  ) : null}
                  {isFailed ? (
                    <button
                      type="button"
                      onClick={() => requeue(n.id)}
                      disabled={busyId === n.id}
                      className="border border-border px-1.5 py-px text-[8px] tracking-widest text-muted-foreground transition-colors enabled:hover:border-warn/60 enabled:hover:text-warn"
                    >
                      {busyId === n.id ? "…" : "RETRY"}
                    </button>
                  ) : null}
                </div>
                {isFailed && n.lastError ? (
                  <p
                    className="mt-1 border border-destructive/30 bg-destructive/5 px-2 py-1 font-mono text-[9px] leading-relaxed text-destructive/90"
                    role="note"
                    aria-label="Delivery failure reason"
                  >
                    ↯ {n.lastError}
                  </p>
                ) : null}
                {open ? (
                  <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap border border-border bg-background/60 p-3 font-mono text-[10px] leading-relaxed text-foreground/90">
                    {n.body}
                  </pre>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  activeClass,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  activeClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "border px-2.5 py-1.5 font-mono text-[10px] tracking-widest transition-colors",
        active
          ? activeClass ?? "border-primary bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
      )}
    >
      {label}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = getStatusMeta(status);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 border px-1.5 py-0.5 font-mono text-[9px] tracking-widest",
        meta.chipClass
      )}
    >
      <span
        className={cn("h-1 w-1 rounded-full", meta.barClass)}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  );
}

function DetailDialog({
  application,
  onUpdated,
  onClose,
}: {
  application: ApplicationRecord | null;
  onUpdated: (updated: ApplicationRecord) => void;
  onClose: () => void;
}) {
  const dept = getDepartment(application?.department);
  const [draftStatus, setDraftStatus] = useState<string>("SUBMITTED");
  const [draftNote, setDraftNote] = useState("");
  const [slotDate, setSlotDate] = useState("");
  const [slotTime, setSlotTime] = useState("");
  const [slotMode, setSlotMode] = useState<string>("GOOGLE_MEET");
  const [slotConflicts, setSlotConflicts] = useState<SlotConflict[] | null>(null);
  const [saving, setSaving] = useState(false);
  const lastAppId = useRef<string | null>(null);

  // sync editor state when a DIFFERENT file is opened - identity-guarded so the
  // optimistic update → server-truth swap (same id) never wipes in-progress
  // editor state like an unresolved SLOT_CONFLICT panel
  useEffect(() => {
    if (!application) {
      lastAppId.current = null;
      return;
    }
    if (application.id !== lastAppId.current) {
      lastAppId.current = application.id;
      setDraftStatus(application.status);
      setDraftNote(application.statusNote ?? "");
      const parts = isoToIstParts(application.interviewAt);
      setSlotDate(parts.date);
      setSlotTime(parts.time);
      setSlotMode(application.interviewMode ?? "GOOGLE_MEET");
      setSlotConflicts(null);
    }
  }, [application]);

  const dirty =
    application &&
    (draftStatus !== application.status ||
      draftNote !== (application.statusNote ?? "") ||
      slotDate !== isoToIstParts(application.interviewAt).date ||
      slotTime !== isoToIstParts(application.interviewAt).time ||
      (draftStatus === "SHORTLISTED" &&
        slotMode !== (application.interviewMode ?? "GOOGLE_MEET")));

  const commit = async (force = false) => {
    if (!application || !dirty) return;
    setSaving(true);
    const interviewAt =
      draftStatus === "SHORTLISTED" ? istPartsToIso(slotDate, slotTime) : null;
    const interviewMode = draftStatus === "SHORTLISTED" ? slotMode : null;
    const optimistic: ApplicationRecord = {
      ...application,
      status: draftStatus,
      statusNote: draftNote.trim() || null,
      statusUpdatedAt: new Date().toISOString(),
      interviewAt,
      interviewMode,
      statusHistory: [
        ...application.statusHistory,
        {
          status: draftStatus,
          note: draftNote.trim() || null,
          by: "you",
          at: new Date().toISOString(),
        },
      ],
    };
    onUpdated(optimistic); // instant feedback
    try {
      const res = await fetch(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: draftStatus,
          note: draftNote.trim() || null,
          interviewAt,
          interviewMode,
          ...(force ? { force: true } : {}),
        }),
      });
      if (res.status === 409) {
        const data = (await res.json().catch(() => null)) as {
          error?: string;
          conflicts?: SlotConflict[];
        } | null;
        if (data?.error === "SLOT_CONFLICT") {
          onUpdated(application); // roll back the optimistic row
          setSlotConflicts(data.conflicts ?? []);
          toast.warning("SLOT_CONFLICT", {
            description:
              "Another candidate holds a slot within ±45 min. Review the clash below - commit --force to double-book anyway.",
          });
          return;
        }
        throw new Error("409");
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { application: ApplicationRecord };
      onUpdated(data.application); // replace with server truth
      setSlotConflicts(null);
      toast.success(`STATUS_COMMITTED · ${getStatusMeta(draftStatus).label}`, {
        description: `${application.fullName} - student sees this live on their receipt.`,
      });
    } catch {
      onUpdated(application); // roll back optimistic patch
      toast.error("COMMIT_FAILED", {
        description: "Could not save the status. Row restored - try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyId = async () => {
    if (!application) return;
    try {
      await navigator.clipboard.writeText(application.id);
      toast("APP_ID_COPIED", { description: application.id });
    } catch {
      toast.error("COPY_FAILED", { description: "Clipboard unavailable" });
    }
  };

  const questionLabel = (id: string): string => {
    for (const q of COMMON_QUESTIONS) if (q.id === id) return q.label;
    for (const q of dept?.questions ?? []) if (q.id === id) return q.label;
    if (LEGACY_QUESTION_LABELS[id]) return LEGACY_QUESTION_LABELS[id];
    return id;
  };

  /**
   * Print the open application as an interviewer one-pager: body.print-detail
   * flips the print stylesheet into "only this dialog on paper" mode; the
   * afterprint listener (plus a Safari-safe timeout) removes it again.
   */
  const printSheet = () => {
    document.body.classList.add("print-detail");
    const cleanup = () => {
      document.body.classList.remove("print-detail");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
    setTimeout(cleanup, 2000); // browsers that never fire afterprint
  };

  const entries = useMemo(() => {
    if (!application) return [];
    return Object.entries(application.answers ?? {}).filter(
      ([, v]) => v?.trim().length
    );
  }, [application]);

  return (
    <Dialog open={Boolean(application)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        data-nx-print-keep
        className="max-h-[85vh] w-full min-w-0 overflow-y-auto overflow-x-hidden border-border bg-popover font-mono [overflow-wrap:anywhere] sm:max-w-2xl [&>*]:min-w-0 [&>*]:max-w-full"
      >
        {application ? (
          <>
            {/* paper-only masthead for the interviewer one-pager */}
            <div className="nx-print-only mb-4 border border-slate-400 px-3 py-2">
              <p className="text-[11px] font-bold tracking-[0.3em]">
                NEXUS // INTERVIEW SHEET - RECRUITMENTS '26
              </p>
              <p className="mt-1 text-[10px] tracking-wider">
                {application.fullName} · d {dept?.dir ?? application.department}/ ·{" "}
                {application.email}
              </p>
              <p className="mt-0.5 text-[9px] tracking-wider text-slate-500">
                printed {new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST ·
                nexus.runs-on.dev
              </p>
            </div>
            <DialogHeader className="min-w-0 max-w-full overflow-hidden">
              <DialogTitle className="flex min-w-0 max-w-full items-center justify-between gap-2 text-left text-base tracking-wider">
                <span className="min-w-0 truncate">
                  <span className="text-primary">$ cat</span> {application.id}.log
                </span>
                <span className="flex shrink-0 items-center gap-1.5" data-nx-screen-only>
                  <button
                    type="button"
                    onClick={printSheet}
                    title="Print the interviewer one-pager"
                    className="border border-border px-2 py-1 text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    PRINT
                  </button>
                  <button
                    type="button"
                    onClick={copyId}
                    title="Copy APP_ID"
                    className="border border-border px-2 py-1 text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                  >
                    COPY_ID
                  </button>
                </span>
              </DialogTitle>
              <DialogDescription asChild>
                <div className="min-w-0 max-w-full space-y-3 overflow-hidden text-left">
                  <div className="grid min-w-0 max-w-full gap-px border border-border bg-border text-xs sm:grid-cols-2">
                    <Meta icon={<Mail className="h-3 w-3" />} label="EMAIL" value={application.email} />
                    <Meta
                      icon={<MessageCircle className="h-3 w-3" />}
                      label="WHATSAPP"
                      value={application.whatsapp?.trim() || "- not on file (legacy row) -"}
                      accent={application.whatsapp?.trim() ? "text-emerald-400" : "text-muted-foreground/60"}
                    />
                    <Meta
                      icon={<CalendarDays className="h-3 w-3" />}
                      label="SUBMITTED"
                      value={new Date(application.submittedAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                        hour12: false,
                      })}
                    />
                    <Meta label="APPLICANT" value={`${application.fullName} · ${formatYearOfStudy(application.yearOfStudy)}`} />
                    <Meta
                      label="DOMAIN"
                      value={`d ${dept?.dir}/ - ${dept?.name ?? application.department}`}
                      accent={dept?.accentClass}
                    />
                    {application.interviewAt ? (
                      <Meta
                        icon={<CalendarClock className="h-3 w-3" />}
                        label="INTERVIEW_SLOT"
                        value={`${new Date(application.interviewAt).toLocaleString(
                          "en-IN",
                          {
                            timeZone: "Asia/Kolkata",
                            weekday: "short",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          }
                        )} IST${
                          application.interviewMode
                            ? ` · ${application.interviewMode}`
                            : ""
                        }`}
                        accent="text-fuchsia-400"
                      />
                    ) : null}
                    {application.clarificationQuestion ? (
                      <Meta
                        icon={<HelpCircle className="h-3 w-3" />}
                        label="CLARIFICATION (LEGACY)"
                        value={`answered ${
                            application.clarificationAnsweredAt
                              ? new Date(application.clarificationAnsweredAt).toLocaleString(
                                  "en-IN",
                                  {
                                    timeZone: "Asia/Kolkata",
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: false,
                                  }
                                )
                              : "-"
                          } IST`}
                        accent="text-orange-400"
                      />
                    ) : null}
                  </div>

                  {(Object.entries(application.links ?? {}) as [keyof Links, string][])
                    .filter(([, v]) => v?.trim())
                    .map(([k, v]) => (
                      <a
                        key={k}
                        href={v.startsWith("http") ? v : `https://${v}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex max-w-full items-center gap-1.5 break-all border border-border bg-secondary/40 px-2.5 py-1 text-[10px] tracking-wider text-primary transition-colors [overflow-wrap:anywhere] hover:bg-secondary"
                      >
                        {k}: {v} <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                      </a>
                    ))}
                </div>
              </DialogDescription>
            </DialogHeader>

            {/* status editor */}
            <section
              className="min-w-0 max-w-full overflow-hidden border border-border bg-secondary/30 p-3"
              aria-label="Review status editor"
            >
              <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                review action - visible to the student live
              </p>
              <div
                role="radiogroup"
                aria-label="Application status"
                className="mt-2 flex flex-wrap gap-1"
              >
                {APPLICATION_STATUSES.map((s) => {
                  const meta = getStatusMeta(s);
                  const active = draftStatus === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      title={meta.adminHint}
                      onClick={() => setDraftStatus(s)}
                      className={cn(
                        "border px-2 py-1 font-mono text-[9px] tracking-widest transition-colors",
                        active
                          ? meta.chipClass
                          : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>

              {/* interview slot scheduler - appears for status = SHORTLISTED */}
              {draftStatus === "SHORTLISTED" ? (
                <div
                  className="mt-3 border border-fuchsia-400/40 bg-fuchsia-400/5 p-3"
                  aria-label="Interview slot scheduler"
                >
                  <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-fuchsia-400">
                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                    schedule slot · IST (Asia/Kolkata)
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-3">
                    <label className="flex flex-col gap-1">
                      <span className="text-[9px] tracking-widest text-muted-foreground">
                        DATE
                      </span>
                      <input
                        type="date"
                        value={slotDate}
                        onChange={(e) => {
                          setSlotDate(e.target.value);
                          setSlotConflicts(null);
                        }}
                        aria-label="Interview date (IST)"
                        className="h-8 border border-input bg-background/80 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[9px] tracking-widest text-muted-foreground">
                        TIME
                      </span>
                      <input
                        type="time"
                        value={slotTime}
                        onChange={(e) => {
                          setSlotTime(e.target.value);
                          setSlotConflicts(null);
                        }}
                        aria-label="Interview time (IST)"
                        className="h-8 border border-input bg-background/80 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[9px] tracking-widest text-muted-foreground">
                        MODE
                      </span>
                      <select
                        value={slotMode}
                        onChange={(e) => setSlotMode(e.target.value)}
                        aria-label="Interview mode"
                        className="h-8 border border-input bg-background/80 px-2 text-[11px] text-foreground focus:border-primary focus:outline-none"
                      >
                        {INTERVIEW_MODES.map((m) => (
                          <option key={m} value={m}>
                            {INTERVIEW_MODE_META[m].label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 text-[9px] leading-relaxed text-muted-foreground/70">
                    {INTERVIEW_MODE_META[slotMode as keyof typeof INTERVIEW_MODE_META]
                      ?.hint ?? ""}{" "}
                    - put the meet link / venue in the note below. The student
                    gets a live countdown on their receipt.
                  </p>
                </div>
              ) : null}

              {/* slot overlap guard - the server refused the double-booking */}
              {slotConflicts && slotConflicts.length > 0 && draftStatus === "SHORTLISTED" ? (
                <div
                  className="mt-3 border border-destructive/50 bg-destructive/5 p-3"
                  role="alert"
                  aria-label="Interview slot conflict"
                >
                  <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-destructive">
                    <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                    $ ntp --check · SLOT_CONFLICT
                  </p>
                  <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground">
                    these files already hold a slot within ±45 min - one panel can't
                    be in two rooms at once:
                  </p>
                  <ul className="mt-2 space-y-1">
                    {slotConflicts.map((c) => (
                      <li
                        key={c.id}
                        className="flex flex-wrap items-baseline gap-x-2 text-[10px]"
                      >
                        <span className="font-bold text-foreground">{c.fullName}</span>
                        <span className="text-muted-foreground">d {c.department}/</span>
                        <span className="text-fuchsia-400">
                          {new Date(c.interviewAt).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}{" "}
                          IST
                        </span>
                        {c.interviewMode ? (
                          <span className="text-muted-foreground/70">{c.interviewMode}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSlotConflicts(null)}
                      className="border border-border px-2.5 py-1 text-[9px] font-bold tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
                    >
                      PICK_ANOTHER_SLOT
                    </button>
                    <span className="text-[9px] text-muted-foreground/60">
                      …or $ COMMIT --force to double-book anyway
                    </span>
                  </div>
                </div>
              ) : null}

              {/* clarification loop is retired - status list is flat now */}

              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="note → student sees this (interview slot, feedback, next steps…)"
                aria-label="Note visible to the student"
                className="mt-2 w-full resize-y border border-input bg-background/80 px-2.5 py-2 font-mono text-[11px] leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
              />
              <div className="mt-2 flex items-center justify-between gap-3">
                <p className="text-[9px] text-muted-foreground/70">
                  {application.reviewedBy
                    ? `last: ${application.reviewedBy.split("@")[0]} · ${
                        application.statusUpdatedAt
                          ? new Date(application.statusUpdatedAt).toLocaleString("en-IN", {
                              timeZone: "Asia/Kolkata",
                              day: "2-digit",
                              month: "short",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                            })
                          : "-"
                      }`
                    : "never reviewed"}
                </p>
                <button
                  type="button"
                  onClick={() => commit(Boolean(slotConflicts && slotConflicts.length > 0))}
                  disabled={!dirty || saving}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 border px-3 text-[10px] font-bold tracking-widest transition-colors",
                    dirty && !saving
                      ? slotConflicts && slotConflicts.length > 0
                        ? "border-destructive bg-destructive text-destructive-foreground hover:shadow-[0_0_18px_rgba(239,68,68,0.5)]"
                        : "border-primary bg-primary text-primary-foreground hover:shadow-[0_0_18px_rgba(96,165,250,0.5)]"
                      : "cursor-not-allowed border-border bg-secondary/40 text-muted-foreground/50"
                  )}
                >
                  {saving
                    ? "COMMITTING…"
                    : dirty
                      ? slotConflicts && slotConflicts.length > 0
                        ? "$ COMMIT --force"
                        : "$ COMMIT --status"
                      : "COMMITTED"}
                </button>
              </div>
            </section>

            {/* review audit trail */}
            {application.statusHistory.length > 0 ? (
              <section
                className="min-w-0 max-w-full overflow-hidden border border-border bg-secondary/30 p-3"
                aria-label="Review history"
              >
                <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                  <History className="h-3 w-3" aria-hidden="true" />
                  $ history --review · {application.statusHistory.length} events
                </p>
                <ol className="mt-2 space-y-1.5">
                  {[...application.statusHistory].reverse().map((event, i) => {
                    const meta = getStatusMeta(event.status);
                    const isStudentReply = event.by === "student";
                    return (
                      <li
                        key={`${event.at}-${i}`}
                        className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[10px]"
                      >
                        <span className="text-muted-foreground/60 tabular-nums">
                          {new Date(event.at).toLocaleString("en-IN", {
                            timeZone: "Asia/Kolkata",
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: false,
                          })}
                        </span>
                        <span
                          className={cn(
                            "border px-1 py-px text-[8px] tracking-widest",
                            isStudentReply
                              ? "border-ok/50 bg-ok/10 text-ok"
                              : meta.chipClass
                          )}
                        >
                          {isStudentReply ? "STUDENT_REPLY" : meta.label}
                        </span>
                        {event.note ? (
                          <span
                            className="min-w-0 max-w-full flex-1 break-all text-muted-foreground/70 [overflow-wrap:anywhere]"
                            title={event.note}
                          >
                            {isStudentReply ? `“${event.note}”` : event.note}
                          </span>
                        ) : null}
                        <span className="text-muted-foreground">
                          by {isStudentReply ? "student" : event.by.split("@")[0]}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ) : null}

            <div className="min-w-0 max-w-full overflow-hidden divide-y divide-border border border-border">
              {entries.map(([id, value]) => (
                <article key={id} className="min-w-0 max-w-full overflow-hidden p-3">
                  <h4 className="max-w-full break-words text-[10px] leading-snug text-muted-foreground [overflow-wrap:anywhere]">
                    <span className="text-primary/70">Q:</span> {questionLabel(id)}
                  </h4>
                  <p className="mt-1.5 max-w-full whitespace-pre-wrap break-all font-sans text-sm leading-relaxed text-foreground [overflow-wrap:anywhere]">
                    {value}
                  </p>
                </article>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 self-start border border-border px-3 text-[10px] tracking-widest text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" /> CLOSE_FILE
            </button>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Meta({
  icon,
  label,
  value,
  accent,
}: {
  icon?: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="min-w-0 max-w-full overflow-hidden bg-card px-3 py-2">
      <p className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </p>
      <p className={cn("mt-0.5 max-w-full break-all text-foreground [overflow-wrap:anywhere]", accent)} title={value}>
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AGENDA - interview day sheet, chronological slots per IST day       */
/* ------------------------------------------------------------------ */

interface AgendaDay {
  date: string; // YYYY-MM-DD (IST)
  slots: ApplicationRecord[];
}

/** "FRI · 05 SEPT" style label from a YYYY-MM-DD IST day key. */
function agendaDayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) return date;
  return d
    .toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "short",
      day: "2-digit",
      month: "short",
    })
    .toUpperCase();
}

function AgendaPanel({ onOpen }: { onOpen: (app: ApplicationRecord) => void }) {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0); // re-render clock for T-minus chips
  const [scanning, setScanning] = useState(false);
  const todayRef = useRef<HTMLDivElement | null>(null);
  const autoScrolled = useRef(false);

  const load = useCallback(async () => {
    setScanning(true);
    try {
      // drive-wide: the agenda ignores the applications-tab filters on purpose
      const res = await fetch("/api/admin/applications?status=SHORTLISTED", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as AdminPayload;
      setApps(payload.applications);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const todayKey = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  const { days, unsotted } = useMemo(() => {
    const list = apps ?? [];
    const map = new Map<string, ApplicationRecord[]>();
    const unsotted: ApplicationRecord[] = [];
    for (const a of list) {
      const parts = isoToIstParts(a.interviewAt ?? null);
      if (!parts.date) {
        unsotted.push(a);
        continue;
      }
      const bucket = map.get(parts.date) ?? [];
      bucket.push(a);
      map.set(parts.date, bucket);
    }
    const days: AgendaDay[] = [...map.entries()]
      .map(([date, slots]) => ({
        date,
        slots: slots.sort((a, b) =>
          String(a.interviewAt).localeCompare(String(b.interviewAt))
        ),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
    return { days, unsotted };
    // `tick` intentionally retriggers the regroup so TODAY badges / T-minus stay honest
  }, [apps, tick]);

  const now = Date.now();
  const upcoming = (apps ?? []).filter(
    (a) => a.interviewAt && new Date(a.interviewAt).getTime() > now
  );
  const next = upcoming
    .slice()
    .sort(
      (a, b) =>
        new Date(String(a.interviewAt)).getTime() -
        new Date(String(b.interviewAt)).getTime()
    )[0];

  /** the day group the auto-scroll should land on: TODAY, else first upcoming */
  const scrollTargetDate =
    days.find((d) => d.date === todayKey)?.date ??
    days.find((d) => d.date > todayKey)?.date ??
    null;

  /** jump to TODAY's (or the first upcoming) day group once, after load */
  useEffect(() => {
    if (autoScrolled.current || !apps || days.length === 0) return;
    const target =
      days.find((d) => d.date === todayKey) ??
      days.find((d) => d.date > todayKey) ??
      null;
    if (target) {
      autoScrolled.current = true;
      requestAnimationFrame(() => {
        todayRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }, [apps]);

  /** plain-text agenda for the core group chat */
  const copyAgenda = useCallback(() => {
    const lines: string[] = ["NEXUS PANEL AGENDA (IST)"];
    for (const day of days) {
      lines.push(
        `${agendaDayLabel(day.date)}${day.date === todayKey ? " · TODAY" : ""} - ${day.slots.length} slot${day.slots.length === 1 ? "" : "s"}`
      );
      for (const s of day.slots) {
        const p = isoToIstParts(s.interviewAt ?? null);
        lines.push(
          `  ${p.time}  ${s.fullName} (${s.department}${s.interviewMode ? ", " + s.interviewMode : ""}) - ${agendaTminus(s.interviewAt as string, now)}`
        );
      }
    }
    if (unsotted.length > 0) lines.push(`NEEDS A SLOT: ${unsotted.length}`);
    if (lines.length === 1) lines.push("no interviews scheduled");
    const text = lines.join("\n");
    navigator.clipboard
      ?.writeText(text)
      .then(() => toast.success("AGENDA_COPIED", { description: `${lines.length - 1} lines → clipboard` }))
      .catch(() => toast.error("CLIPBOARD_BLOCKED", { description: "could not copy the agenda" }));
  }, [days, unsotted.length, todayKey, now]);

  return (
    <section className="terminal-panel mt-4" aria-label="Interview agenda">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          <CalendarClock className="h-3 w-3" aria-hidden="true" />
          $ cal --interviews · chronological · IST
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground/60">
            {failed
              ? "OFFLINE - retry"
              : `${(apps ?? []).length} scheduled · ${upcoming.length} ahead`}
          </span>
          <button
            type="button"
            onClick={copyAgenda}
            disabled={!days.length && !unsotted.length}
            title="copy the panel agenda as plain text"
            className="inline-flex h-7 items-center gap-1.5 border border-border px-2.5 font-mono text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
          >
            <Copy className="h-3 w-3" aria-hidden="true" />
            COPY
          </button>
          <button
            type="button"
            onClick={() => load()}
            disabled={scanning}
            title="rescan interview slots"
            className="inline-flex h-7 items-center gap-1.5 border border-border px-2.5 font-mono text-[9px] tracking-widest text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary disabled:opacity-40"
          >
            <RefreshCw className={cn("h-3 w-3", scanning && "animate-spin")} aria-hidden="true" />
            {scanning ? "SCANNING…" : "RESCAN"}
          </button>
        </div>
      </div>

      {/* next-up strip */}
      {next?.interviewAt ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-border bg-primary/5 px-4 py-2.5 font-mono text-[10px] tracking-widest">
          <span className="text-primary">NEXT_UP →</span>
          <button
            type="button"
            onClick={() => onOpen(next)}
            className="font-bold text-foreground underline-offset-4 hover:text-primary hover:underline"
          >
            {next.fullName}
          </button>
          <span className="text-muted-foreground">
            {isoToIstParts(next.interviewAt).date === todayKey
              ? "TODAY"
              : agendaDayLabel(isoToIstParts(next.interviewAt).date)}{" "}
            {isoToIstParts(next.interviewAt).time} IST
          </span>
          <span className="text-warn tabular-nums">
            {agendaTminus(next.interviewAt as string, now)}
          </span>
        </div>
      ) : null}

      <div className="p-4">
        {failed ? (
          <p className="border border-destructive/40 bg-destructive/10 px-3 py-2 font-mono text-[10px] tracking-widest text-destructive">
            AGENDA_OFFLINE - the slot list could not be loaded. RESCAN from the
            applications tab or refresh.
          </p>
        ) : apps === null ? (
          <p className="py-6 text-center font-mono text-xs text-muted-foreground">
            reading /var/panel/agenda<span className="animate-pulse">▊</span>
          </p>
        ) : days.length === 0 && unsotted.length === 0 ? (
          <p className="py-6 text-center font-mono text-xs text-muted-foreground/70">
            no interviews scheduled - SHORTLIST a file and set a slot.
          </p>
        ) : (
          <div className="space-y-5">
            {days.map((day) => {
              const isToday = day.date === todayKey;
              const isPast = day.date < todayKey;
              return (
                <div
                  key={day.date}
                  ref={day.date === scrollTargetDate ? todayRef : undefined}
                >
                  <div
                    className={cn(
                      "sticky top-[84px] z-10 flex items-center justify-between border px-3 py-1.5 font-mono text-[10px] tracking-[0.2em]",
                      isToday
                        ? "border-ok/50 bg-[#071510] text-ok"
                        : isPast
                          ? "border-border bg-[#0b111a] text-muted-foreground/60"
                          : "border-border bg-[#0c1420] text-muted-foreground"
                    )}
                  >
                    <span className="flex items-center gap-2">
                      {isToday ? <span className="status-dot" aria-hidden="true" /> : null}
                      {agendaDayLabel(day.date)}
                      {isToday ? " · TODAY" : isPast ? " · PAST" : ""}
                    </span>
                    <span className="tabular-nums">{day.slots.length} SLOTS</span>
                  </div>
                  <ul>
                    {day.slots.map((app) => (
                      <AgendaRow key={app.id} app={app} now={now} onOpen={onOpen} />
                    ))}
                  </ul>
                </div>
              );
            })}

            {unsotted.length > 0 ? (
              <div>
                <div className="flex items-center justify-between border border-warn/50 bg-warn/10 px-3 py-1.5 font-mono text-[10px] tracking-[0.2em] text-warn">
                  <span className="flex items-center gap-2">
                    <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                    NEEDS A SLOT
                  </span>
                  <span className="tabular-nums">{unsotted.length}</span>
                </div>
                <ul>
                  {unsotted.map((app) => (
                    <AgendaRow key={app.id} app={app} now={now} onOpen={onOpen} />
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

/** Live T-minus chip text for a slot, minute granularity. */
function agendaTminus(iso: string, now: number): string {
  const diff = new Date(iso).getTime() - now;
  if (Number.isNaN(diff)) return "-";
  if (diff <= -45 * 60_000) return "DONE";
  if (diff <= 0) return "LIVE NOW";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  return d > 0 ? `in ${d}d ${String(h).padStart(2, "0")}h` : `in ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function AgendaRow({
  app,
  now,
  onOpen,
}: {
  app: ApplicationRecord;
  now: number;
  onOpen: (app: ApplicationRecord) => void;
}) {
  const parts = isoToIstParts(app.interviewAt ?? null);
  const dept = getDepartment(app.department);
  const modeMeta = isInterviewMode(app.interviewMode)
    ? INTERVIEW_MODE_META[app.interviewMode]
    : null;
  const live =
    app.interviewAt &&
    (() => {
      const diff = new Date(app.interviewAt).getTime() - now;
      return diff <= 0 && diff > -45 * 60_000;
    })();

  return (
    <li
      className={cn(
        "flex items-center gap-3 border border-t-0 border-border bg-card px-3 py-2.5 transition-colors hover:border-primary/40",
        live && "border-l-2 border-l-ok"
      )}
    >
      <span className="w-12 shrink-0 font-mono text-sm font-bold text-foreground tabular-nums">
        {parts.time || "--:--"}
      </span>
      <span
        className={cn(
          "w-20 shrink-0 font-mono text-[9px] tracking-widest tabular-nums",
          live ? "ok-text" : "text-warn"
        )}
      >
        {app.interviewAt ? agendaTminus(app.interviewAt, now) : "PENDING"}
      </span>
      <button
        type="button"
        onClick={() => onOpen(app)}
        className="min-w-0 flex-1 truncate text-left font-mono text-xs text-foreground underline-offset-4 hover:text-primary hover:underline"
        title="open the file"
      >
        {app.fullName}
        <span className="ml-2 text-[9px] tracking-widest text-muted-foreground">
          {formatYearOfStudy(app.yearOfStudy)}
          <span className="ml-1.5 text-muted-foreground/50">
            '{String(app.joinYear).slice(2)}
          </span>
        </span>
      </button>
      <span className="hidden items-center gap-1.5 font-mono text-[9px] tracking-widest text-muted-foreground sm:flex">
        <span
          className={cn("h-1.5 w-1.5", DEPT_COLORS[app.department] ?? "bg-primary")}
          aria-hidden="true"
        />
        d {dept?.dir ?? app.department}/
      </span>
      <span className="hidden border border-border px-1.5 py-px font-mono text-[8px] tracking-widest text-muted-foreground/80 md:inline">
        {modeMeta?.label ?? app.interviewMode ?? "MODE TBD"}
      </span>
    </li>
  );
}

/* ------------------------------------------------------------------ */
/* OPSDAY - day-of interview operations strip. Renders above the tab   */
/* bar whenever any interview slot lands on TODAY (IST): live IST      */
/* clock, per-slot T-minus with seconds, IN SESSION glow. Independent  */
/* of the applications-tab filters (fetches its own INTERVIEW list).   */
/* ------------------------------------------------------------------ */

const SLOT_WINDOW_MS = 45 * 60_000; // matches the agenda's LIVE NOW window

function OpsDayStrip({ onOpen }: { onOpen: (app: ApplicationRecord) => void }) {
  const [apps, setApps] = useState<ApplicationRecord[] | null>(null);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/applications?status=SHORTLISTED", {
        cache: "no-store",
      });
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as AdminPayload;
      setApps(payload.applications);
    } catch {
      setApps(null); // strip stays silent on failure - never blocks the console
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 120_000); // slow re-sync; the clock is local
    return () => clearInterval(id);
  }, [load]);

  const todayKey = new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Kolkata",
  });

  const todaySlots = useMemo(() => {
    const list = (apps ?? []).filter((a) => {
      const parts = isoToIstParts(a.interviewAt ?? null);
      return parts.date === todayKey;
    });
    return list.sort((a, b) =>
      String(a.interviewAt).localeCompare(String(b.interviewAt))
    );
    // `tick` keeps T-minus honest across the second-hand re-render
  }, [apps, todayKey, tick]);

  // tick once per second - only while there is something ticking on
  const hasToday = (apps?.length ?? 0) > 0 && todaySlots.length > 0;
  useEffect(() => {
    if (!hasToday) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [hasToday]);

  if (!hasToday || !apps) return null;

  const now = Date.now();
  const clock = new Date(now).toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const liveCount = todaySlots.filter((s) => {
    const diff = new Date(String(s.interviewAt)).getTime() - now;
    return diff <= 0 && diff > -SLOT_WINDOW_MS;
  }).length;

  return (
    <section
      className="terminal-panel mt-4 border-l-2 border-l-ok"
      aria-label="Interview operations today"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/50 px-4 py-2">
        <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          <span className="status-dot" aria-hidden="true" />
          $ opsday --today
          <span className="text-ok">· {liveCount > 0 ? `${liveCount} IN SESSION` : "STANDBY"}</span>
        </span>
        <span
          className="font-mono text-[10px] tabular-nums text-foreground/80"
          aria-hidden="true"
        >
          {clock} IST
        </span>
        <span className="sr-only">
          {todaySlots.length} interview{todaySlots.length === 1 ? "" : "s"} scheduled today.
          {liveCount > 0 ? ` ${liveCount} currently in session.` : ""}
        </span>
      </div>

      <ul className="divide-y divide-border">
        {todaySlots.map((app) => {
          const iso = String(app.interviewAt);
          const start = new Date(iso).getTime();
          const diff = start - now;
          const inSession = diff <= 0 && diff > -SLOT_WINDOW_MS;
          const done = diff <= -SLOT_WINDOW_MS;
          const dept = getDepartment(app.department);
          const modeMeta = isInterviewMode(app.interviewMode)
            ? INTERVIEW_MODE_META[app.interviewMode]
            : null;
          return (
            <li
              key={app.id}
              className={cn(
                "flex items-center gap-3 bg-card px-4 py-2 transition-colors hover:bg-secondary/40",
                inSession && "bg-ok/5",
                done && "opacity-55"
              )}
            >
              <span
                className={cn(
                  "w-12 shrink-0 font-mono text-sm font-bold tabular-nums",
                  inSession ? "ok-text" : done ? "text-muted-foreground" : "text-foreground"
                )}
              >
                {isoToIstParts(iso).time}
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "w-24 shrink-0 border px-1.5 py-px text-center font-mono text-[9px] tracking-widest tabular-nums",
                  inSession
                    ? "border-ok/60 bg-ok/15 text-ok"
                    : done
                      ? "border-border text-muted-foreground/50"
                      : "border-warn/50 bg-warn/10 text-warn"
                )}
              >
                {inSession ? "◉ IN SESSION" : done ? "DONE" : `T-${tminusHms(diff)}`}
              </span>
              <button
                type="button"
                onClick={() => onOpen(app)}
                className="min-w-0 flex-1 truncate text-left font-mono text-xs text-foreground underline-offset-4 hover:text-primary hover:underline"
                title="open the file"
              >
                {app.fullName}
                <span className="ml-2 text-[9px] tracking-widest text-muted-foreground">
                  {formatYearOfStudy(app.yearOfStudy)}
                </span>
              </button>
              <span className="hidden items-center gap-1.5 font-mono text-[9px] tracking-widest text-muted-foreground sm:flex">
                <span
                  className={cn("h-1.5 w-1.5", DEPT_COLORS[app.department] ?? "bg-primary")}
                  aria-hidden="true"
                />
                d {dept?.dir ?? app.department}/
              </span>
              <span className="hidden border border-border px-1.5 py-px font-mono text-[8px] tracking-widest text-muted-foreground/80 md:inline">
                {modeMeta?.label ?? app.interviewMode ?? "MODE TBD"}
              </span>
              <StatusBadge status={app.status} />
            </li>
          );
        })}
      </ul>
      <p className="border-t border-border/60 bg-background/40 px-4 py-1.5 font-mono text-[9px] text-muted-foreground/60">
        slot window 45 min · times IST · resyncs every 2 min
      </p>
    </section>
  );
}

/** Day-of T-minus at second granularity: HH:MM:SS (capped at 99h). */
function tminusHms(diffMs: number): string {
  const safe = Math.max(0, diffMs);
  const h = Math.min(99, Math.floor(safe / 3_600_000));
  const m = Math.floor((safe % 3_600_000) / 60_000);
  const s = Math.floor((safe % 60_000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/* STATS ACCESS - the public funnel is SEALED by default; unlocking    */
/* (or re-sealing) requires the STATS_LOCK_SECRET.                     */
/* ------------------------------------------------------------------ */

function StatsAccessToggle() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [configured, setConfigured] = useState(true);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/stats-lock", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { enabled: boolean; configured: boolean } | null) => {
        if (d) {
          setEnabled(d.enabled);
          setConfigured(d.configured);
        }
      })
      .catch(() => undefined);
  }, []);

  const flip = async () => {
    if (enabled === null) return;
    if (!password.trim()) {
      setError("The unlock secret is required.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stats-lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !enabled, password: password.trim() }),
      });
      if (res.status === 403) {
        const d = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(d?.message ?? "Wrong unlock secret - the console stays sealed.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { enabled: boolean };
      setEnabled(d.enabled);
      setOpen(false);
      setPassword("");
      toast.success(d.enabled ? "STATS_CONSOLE_OPEN" : "STATS_CONSOLE_SEALED", {
        description: d.enabled
          ? "The live funnel is public at /stats - OG cards unfurl real numbers again."
          : "The live funnel is private - /stats shows the sealed view to non-core.",
      });
    } catch {
      setError("Could not reach the lock endpoint - try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Public stats console - unlock requires the secret"
        className={cn(
          "inline-flex h-9 items-center gap-2 border px-3 font-mono text-[10px] tracking-widest transition-colors",
          enabled
            ? "border-ok/50 bg-ok/10 text-ok hover:bg-ok hover:text-[#05080d]"
            : "border-destructive/50 bg-destructive/5 text-destructive hover:bg-destructive/15"
        )}
      >
        {enabled ? (
          <Unlock className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Lock className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        STATS: {enabled === null ? "…" : enabled ? "PUBLIC" : "SEALED"}
      </button>

      <Dialog open={open} onOpenChange={(o) => !o && setOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden border-border bg-popover font-mono sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-left text-sm tracking-wider">
              <KeyRound className="h-4 w-4 text-warn" aria-hidden="true" />
              $ stats --access
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-3 text-left">
                <p className="font-sans text-sm text-muted-foreground">
                  The live funnel at <span className="font-mono text-foreground">/stats</span> is
                  currently{" "}
                  <span className={enabled ? "text-ok" : "text-destructive"}>
                    {enabled ? "PUBLIC" : "SEALED"}
                  </span>
                  . Flipping the switch requires the unlock secret (
                  <span className="font-mono text-foreground">STATS_LOCK_SECRET</span>) in both
                  directions - no accidental publishes.
                </p>
                <div>
                  <label
                    htmlFor="stats-lock-secret"
                    className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground"
                  >
                    unlock secret
                  </label>
                  <input
                    id="stats-lock-secret"
                    type="password"
                    autoComplete="off"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && password.trim() && !busy) flip();
                    }}
                    placeholder="••••••••••••"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "stats-lock-error" : undefined}
                    className="h-10 w-full border border-input bg-background/80 px-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none"
                  />
                  {error ? (
                    <p
                      id="stats-lock-error"
                      role="alert"
                      className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-destructive"
                    >
                      <TriangleAlert className="h-3 w-3" aria-hidden="true" /> {error}
                    </p>
                  ) : null}
                  {!configured ? (
                    <p className="mt-2 font-mono text-[10px] text-warn">
                      ⚠ STATS_LOCK_SECRET is not set on the server - the console cannot be
                      unlocked until it is configured.
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center justify-between gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="border border-border px-3 py-1.5 text-[10px] tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                  >
                    CANCEL
                  </button>
                  <button
                    type="button"
                    onClick={flip}
                    disabled={busy || !password.trim()}
                    className={cn(
                      "inline-flex items-center gap-2 border px-4 py-1.5 text-[10px] font-bold tracking-widest transition-colors disabled:opacity-50",
                      enabled
                        ? "border-destructive bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                        : "border-ok bg-ok/10 text-ok hover:bg-ok hover:text-[#05080d]"
                    )}
                  >
                    {busy ? "VERIFYING…" : enabled ? "SEAL CONSOLE" : "OPEN CONSOLE"}
                  </button>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* EMAIL COMPOSER - custom mail to selected applicants, templated      */
/* ------------------------------------------------------------------ */

const TEMPLATE_VARS = [
  ["{{name}}", "student's full name"],
  ["{{domain}}", "department applied to"],
  ["{{status}}", "current status"],
  ["{{year}}", "year of study"],
  ["{{whatsapp}}", "WhatsApp number on file"],
] as const;

function EmailComposer({
  open,
  apps,
  onClose,
  onQueued,
}: {
  open: boolean;
  apps: ApplicationRecord[];
  onClose: () => void;
  onQueued: (queued: number) => void;
}) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const preview = useMemo(() => {
    const a = apps[0];
    if (!a) return { subject, message };
    const merge = (tpl: string) =>
      tpl
        .replaceAll("{{name}}", a.fullName)
        .replaceAll("{{domain}}", getDepartment(a.department)?.name ?? a.department)
        .replaceAll("{{status}}", a.status)
        .replaceAll("{{year}}", String(a.yearOfStudy))
        .replaceAll("{{whatsapp}}", a.whatsapp || "-");
    return { subject: merge(subject), message: merge(message) };
  }, [apps, subject, message]);

  const send = async () => {
    if (busy || apps.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notifications/custom", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: apps.map((a) => a.id), subject, message }),
      });
      if (res.status === 400) {
        const d = (await res.json().catch(() => null)) as { message?: string } | null;
        setError(d?.message ?? "Subject and message are required.");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const d = (await res.json()) as { queued: number };
      setSubject("");
      setMessage("");
      onQueued(d.queued);
    } catch {
      setError("Could not queue the mail - try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto overflow-x-hidden border-border bg-popover font-mono sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-left text-sm tracking-wider">
            <MailPlus className="h-4 w-4 text-fuchsia-300" aria-hidden="true" />
            $ mail --custom · {apps.length} recipient{apps.length === 1 ? "" : "s"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left">
              <p className="font-sans text-sm text-muted-foreground">
                One mail per student, merged per-recipient and queued in the outbox as{" "}
                <span className="font-mono text-fuchsia-300">CUSTOM</span> - FLUSH_QUEUE
                delivers via SMTP.
              </p>

              {/* recipients */}
              {apps.length > 0 ? (
                <ul className="max-h-24 space-y-1 overflow-y-auto border border-border bg-background/60 p-2 font-mono text-[10px] text-muted-foreground">
                  {apps.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span className="truncate text-foreground">{a.fullName}</span>
                      <span className="shrink-0 truncate text-muted-foreground/60">
                        {a.email.split("@")[0]} · {a.status}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="border border-warn/40 bg-warn/10 px-3 py-2 font-mono text-[10px] text-warn">
                  no recipients selected - tick rows in the applications table first.
                </p>
              )}

              {/* subject */}
              <div>
                <label htmlFor="mail-subject" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  subject
                </label>
                <input
                  id="mail-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={160}
                  placeholder="[NEXUS '26] {{name}} - your {{domain}} application"
                  className="h-10 w-full border border-input bg-background/80 px-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none"
                />
              </div>

              {/* message */}
              <div>
                <label htmlFor="mail-message" className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  message
                </label>
                <textarea
                  id="mail-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={4000}
                  rows={6}
                  placeholder={"Hi {{name}},\n\nWe shortlisted your {{domain}} application - your interview slot is…"}
                  className="w-full resize-y border border-input bg-background/80 px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none"
                />
                <p className="mt-1 font-mono text-[9px] text-muted-foreground/60">
                  {message.length}/4000 · variables:{" "}
                  {TEMPLATE_VARS.map(([v, d]) => (
                    <span key={v} title={d} className="mr-1.5 text-primary/80">
                      {v}
                    </span>
                  ))}
                </p>
              </div>

              {/* merged preview */}
              {apps.length > 0 && (subject || message) ? (
                <div className="border border-border bg-background/60 p-3">
                  <p className="text-[9px] uppercase tracking-[0.25em] text-muted-foreground">
                    preview - merged for {apps[0].fullName}
                  </p>
                  <p className="mt-1 break-words text-xs font-bold text-foreground">
                    {preview.subject || "(no subject)"}
                  </p>
                  <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-muted-foreground">
                    {preview.message || "(empty body)"}
                  </p>
                </div>
              ) : null}

              {error ? (
                <p role="alert" className="flex items-center gap-1.5 font-mono text-[10px] text-destructive">
                  <TriangleAlert className="h-3 w-3" aria-hidden="true" /> {error}
                </p>
              ) : null}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="border border-border px-3 py-1.5 text-[10px] tracking-widest text-muted-foreground transition-colors hover:text-foreground"
                >
                  DISCARD
                </button>
                <button
                  type="button"
                  onClick={send}
                  disabled={busy || apps.length === 0 || subject.trim().length < 3 || message.trim().length < 3}
                  className="inline-flex items-center gap-2 border border-fuchsia-400/60 bg-fuchsia-400/10 px-4 py-1.5 text-[10px] font-bold tracking-widest text-fuchsia-300 transition-colors enabled:hover:bg-fuchsia-400 enabled:hover:text-[#05080d] disabled:opacity-50"
                >
                  <Send className="h-3 w-3" aria-hidden="true" />
                  {busy ? "QUEUEING…" : `QUEUE ${apps.length} MAIL${apps.length === 1 ? "" : "S"}`}
                </button>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}
