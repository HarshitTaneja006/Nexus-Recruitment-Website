"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileEdit,
  History,
  Home,
  MessageCircle,
  MessageSquareQuote,
  Printer,
  Radio,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { getDepartment, COMMON_QUESTIONS } from "@/lib/departments";
import { formatYearOfStudy } from "@/lib/vit";
import { DRIVE_DEADLINE } from "@/lib/drive";
import { useDriveOpen } from "@/lib/drive-client";
import {
  STATUS_PIPELINE,
  getStatusMeta,
  isTerminalStatus,
  pipelineStageIndex,
} from "@/lib/status";
import type { ApplicationRecord } from "@/lib/storage";
import { cn } from "@/lib/utils";

/**
 * Post-submission state: receipt + live review status pipeline + core
 * messages + read-only answers + re-open (edit) while the drive is open.
 *
 * The status is polled every 25s (unless a terminal decision arrived) so
 * students see review progress without refreshing.
 */
export function SubmittedView({
  application: initial,
  onReopen,
}: {
  application: ApplicationRecord;
  onReopen?: () => void;
}) {
  const [application, setApplication] = useState(initial);
  const [live, setLive] = useState(false); // server poll active
  const [showAnswers, setShowAnswers] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/application", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { application: ApplicationRecord | null };
      if (data.application) setApplication((prev) => ({ ...prev, ...data.application }));
    } catch {
      /* offline - last known status stays on screen */
    }
  }, []);

  useEffect(() => {
    // terminal decisions stop the polling to save the student's battery
    if (isTerminalStatus(application.status)) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      requestAnimationFrame(() => setLive(false));
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
    const id = setInterval(poll, 25_000);
    timer.current = id;
    requestAnimationFrame(() => setLive(true));
    return () => {
      if (id) clearInterval(id);
    };
  }, [application.status, poll]);

  const dept = getDepartment(application.department);
  const meta = getStatusMeta(application.status);
  const driveOpen = useDriveOpen();

  const submittedAt = new Date(application.submittedAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const answeredEntries = Object.entries(application.answers).filter(
    ([, v]) => v.trim().length > 0
  );

  const questionLabel = (id: string): string => {
    for (const q of COMMON_QUESTIONS) if (q.id === id) return q.label;
    for (const q of dept?.questions ?? []) if (q.id === id) return q.label;
    return id;
  };

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(application.id);
      toast("APP_ID_COPIED", { description: application.id });
    } catch {
      toast.error("COPY_FAILED", { description: "Clipboard unavailable" });
    }
  };

  return (
    <div className="space-y-6">
      {/* receipt */}
      <section className="terminal-panel" aria-label="Application receipt">
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ status --application
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[9px] tracking-[0.2em]",
              meta.chipClass
            )}
          >
            <span
              className={cn("h-1.5 w-1.5 rounded-full", meta.barClass, !isTerminalStatus(application.status) && "animate-pulse")}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        </div>
        <div className="p-6 text-center">
          {application.status === "ACCEPTED" ? (
            <CheckCircle2 className="mx-auto h-12 w-12 ok-text" aria-hidden="true" />
          ) : (
            <CheckCircle2
              className={cn("mx-auto h-12 w-12", application.status === "REJECTED" ? "text-muted-foreground/50" : "text-primary")}
              aria-hidden="true"
            />
          )}
          <h1 className="mt-4 font-mono text-xl font-bold tracking-wide">
            APPLICATION_COMMITTED
          </h1>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            Your transmission reached <span className="text-primary">d {dept?.dir}/</span> - domain
            leads have it in their review queue.
          </p>

          <dl className="mx-auto mt-6 grid max-w-md gap-px border border-border bg-border text-left">
            {[
              ["APP_ID", application.id],
              ["SUBMITTED_AT", submittedAt],
              ["DOMAIN", `d ${dept?.dir}/ - ${dept?.name ?? application.department}`],
              ["APPLICANT", `${application.fullName} · ${formatYearOfStudy(application.yearOfStudy)}`],
              ["WHATSAPP", application.whatsapp?.trim() || "- not on file (edit & re-submit to add) -"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 bg-card px-3 py-2">
                <dt className="flex shrink-0 items-center gap-1 font-mono text-[10px] tracking-[0.18em] text-muted-foreground">
                  {k === "WHATSAPP" ? (
                    <MessageCircle className="h-3 w-3 text-emerald-400" aria-hidden="true" />
                  ) : null}
                  {k}
                </dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-foreground" title={v}>{v}</span>
                  {k === "APP_ID" ? (
                    <button
                      type="button"
                      onClick={copyId}
                      title="Copy APP_ID"
                      aria-label={`Copy application id ${application.id}`}
                      className="shrink-0 text-muted-foreground transition-colors hover:text-primary"
                    >
                      <Copy className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>

          {driveOpen ? (
            <p className="mt-5 font-mono text-[10px] leading-relaxed text-muted-foreground">
              edits allowed until{" "}
              {DRIVE_DEADLINE.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}{" "}
              23:59 IST · re-submitting overwrites this version
            </p>
          ) : (
            <p className="mt-5 font-mono text-[10px] leading-relaxed text-warn">
              drive closed · this version is final
            </p>
          )}
        </div>
      </section>

      {/* live status pipeline */}
      <StatusPipeline status={application.status} live={live} />

      {/* interview slot card */}
      {application.interviewAt ? <InterviewCard application={application} /> : null}

      {/* core message */}
      {application.statusNote ? (
        <section className="terminal-panel" aria-label="Message from the core team">
          <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              $ tail -f /var/core/messages.log
            </span>
            <span className="font-mono text-[9px] text-muted-foreground/60">
              {application.reviewedBy ? `from ${application.reviewedBy.split("@")[0]}` : "core"}
            </span>
          </div>
          <div className="flex gap-3 p-4">
            <MessageSquareQuote className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <p className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
              {application.statusNote}
            </p>
          </div>
        </section>
      ) : null}

      {/* review audit trail (compact) */}
      <HistoryLog events={application.statusHistory} />

      {/* status copy */}
      <div
        className={cn(
          "flex items-start gap-2 border px-4 py-3",
          meta.chipClass
        )}
        role="status"
      >
        <Radio className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p className="font-sans text-sm leading-relaxed">{meta.studentCopy}</p>
      </div>

      {/* actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        {onReopen && driveOpen ? (
          <button
            type="button"
            onClick={onReopen}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 border border-primary bg-primary/15 px-5 font-mono text-xs font-bold tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <FileEdit className="h-4 w-4" aria-hidden="true" />
            ./REOPEN --edit
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setShowAnswers((v) => !v)}
          aria-expanded={showAnswers}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 border border-border bg-secondary/50 px-5 font-mono text-xs tracking-widest text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          {showAnswers ? "HIDE" : "VIEW"} ANSWERS
          <ChevronDown className={`h-4 w-4 transition-transform ${showAnswers ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="no-print inline-flex h-11 flex-1 items-center justify-center gap-2 border border-border bg-secondary/50 px-5 font-mono text-xs tracking-widest text-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          PRINT_RECEIPT
        </button>
        <Link
          href="/"
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 border border-border px-5 font-mono text-xs tracking-widest text-muted-foreground transition-colors hover:text-foreground"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          BACK_HOME
        </Link>
      </div>

      {/* answers */}
      {showAnswers ? (
        <section className="terminal-panel" aria-label="Your submitted answers">
          <div className="border-b border-border bg-secondary/50 px-4 py-2">
            <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
              $ cat answers.log
            </span>
          </div>
          <div className="divide-y divide-border">
            {answeredEntries.map(([id, value]) => (
              <article key={id} className="p-4">
                <h3 className="font-mono text-[11px] leading-snug text-muted-foreground">
                  <span className="text-primary/70">Q:</span> {questionLabel(id)}
                </h3>
                <p className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-foreground">
                  {value}
                </p>
              </article>
            ))}
            {Object.entries(application.links ?? {})
              .filter(([, v]) => v.trim().length > 0)
              .map(([k, v]) => (
                <article key={k} className="p-4">
                  <h3 className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                    <span className="text-primary/70">LINK:</span> {k}
                  </h3>
                  <a
                    href={v.startsWith("http") ? v : `https://${v}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block break-all font-mono text-xs text-primary hover:underline"
                  >
                    {v}
                  </a>
                </article>
              ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Horizontal stage tracker: SUBMITTED → IN_REVIEW → SHORTLISTED → INTERVIEW → DECISION.
 * Completed stages glow, current stage pulses, future stages stay dim.
 */
export function StatusPipeline({
  status,
  live,
}: {
  status: string;
  live: boolean;
}) {
  const idx = pipelineStageIndex(status);
  const meta = getStatusMeta(status);
  // final stage shows the actual decision only when one exists;
  // otherwise it stays a neutral "DECISION" placeholder
  const decisionLabel = isTerminalStatus(status) ? meta.label : "DECISION";

  return (
    <section className="terminal-panel" aria-label="Review progress">
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          $ watch --pipeline
        </span>
        <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest text-muted-foreground/70">
          <span
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              live ? "animate-pulse bg-ok" : "bg-muted-foreground/50"
            )}
            aria-hidden="true"
          />
          {live ? "LIVE · auto-refresh 25s" : "FINAL"}
        </span>
      </div>

      <ol className="flex items-stretch gap-0 overflow-x-auto p-4" role="list">
        {STATUS_PIPELINE.map((stage, i) => {
          const done = i < idx;
          const current = i === idx;
          const isDecision = stage === "DECISION";
          const label = isDecision ? decisionLabel : getStatusMeta(stage).label;
          return (
            <li
              key={stage}
              aria-current={current ? "step" : undefined}
              className="flex min-w-0 flex-1 items-center"
            >
              <div className="flex min-w-16 flex-col items-center gap-1.5">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center border font-mono text-[9px] font-bold transition-all",
                    done && "border-ok/60 bg-ok/15 text-ok",
                    current && !isTerminalStatus(status) && cn("border-primary bg-primary/20 text-primary", live && "animate-pulse"),
                    current && isTerminalStatus(status) && meta.chipClass,
                    !done && !current && "border-border text-muted-foreground/40"
                  )}
                >
                  {done ? "✓" : String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "whitespace-nowrap text-center font-mono text-[8px] tracking-[0.14em]",
                    done && "text-ok/80",
                    current && "text-foreground font-bold",
                    !done && !current && "text-muted-foreground/40"
                  )}
                >
                  {label}
                </span>
              </div>
              {i < STATUS_PIPELINE.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "mx-1 h-px flex-1 border-t border-dashed",
                    i < idx ? "border-ok/50" : "border-border/60"
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>

      {isTerminalStatus(status) && application_footer_note(status)}
    </section>
  );
}

function application_footer_note(status: string) {
  const meta = getStatusMeta(status);
  return (
    <p className={cn("border-t border-border px-4 py-2 font-mono text-[9px] tracking-[0.2em]", meta.textClass)}>
      decision recorded{meta.label === "ACCEPTED" ? " - check your inbox" : ""} · pipeline archived
    </p>
  );
}

/**
 * Interview slot card: date/time in IST, mode, and a live countdown while
 * the slot is still in the future. Rendered only when the core team has
 * scheduled a slot on the application.
 */
function InterviewCard({ application }: { application: ApplicationRecord }) {
  const slot = new Date(application.interviewAt as string);
  const valid = !Number.isNaN(slot.getTime());
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    if (!valid || slot.getTime() < Date.now()) return;
    const raf = requestAnimationFrame(() => setNow(Date.now()));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  }, [application.interviewAt, valid]);

  const when = valid
    ? slot.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "2-digit",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : String(application.interviewAt);

  const modeLabel =
    application.interviewMode === "IN_PERSON"
      ? "IN_PERSON"
      : application.interviewMode === "PHONE"
        ? "PHONE"
        : application.interviewMode === "GOOGLE_MEET"
          ? "GOOGLE_MEET"
          : null;

  const diff = valid && now !== null ? slot.getTime() - now : null;
  const countdown =
    diff !== null && diff > 0
      ? [
          ["D", Math.floor(diff / 86_400_000)],
          ["H", Math.floor((diff / 3_600_000) % 24)],
          ["M", Math.floor((diff / 60_000) % 60)],
          ["S", Math.floor((diff / 1_000) % 60)],
        ] as [string, number][]
      : null;

  return (
    <section
      className="terminal-panel border-fuchsia-400/40"
      aria-label="Interview slot"
    >
      <div className="flex items-center justify-between border-b border-fuchsia-400/30 bg-fuchsia-400/10 px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-fuchsia-400">
          $ calendar --interview
        </span>
        <span className="font-mono text-[9px] tracking-widest text-fuchsia-400/80">
          {modeLabel ?? "SLOT CONFIRMED"}
        </span>
      </div>
      <div className="flex flex-col items-center gap-4 p-5 sm:flex-row sm:justify-between">
        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <CalendarClock className="h-8 w-8 shrink-0 text-fuchsia-400" aria-hidden="true" />
          <div>
            <p className="font-mono text-sm font-bold tracking-wide text-foreground">
              {when} <span className="text-fuchsia-400">IST</span>
            </p>
            <p className="mt-0.5 font-sans text-xs text-muted-foreground">
              {modeLabel === "IN_PERSON"
                ? "On campus - venue & panel in the core message below."
                : modeLabel === "PHONE"
                  ? "We'll call you - keep your phone reachable."
                  : modeLabel === "GOOGLE_MEET"
                    ? "Online - the meet link is in the core message below."
                    : "Slot confirmed - details in the core message below."}
            </p>
          </div>
        </div>
        {countdown ? (
          <div className="flex flex-col items-center gap-2.5">
            <div
              className="grid grid-cols-4 gap-px border border-fuchsia-400/40 bg-fuchsia-400/40"
              role="timer"
              aria-label="Time remaining until the interview"
            >
              {countdown.map(([unit, value]) => (
                <div key={unit} className="bg-card px-2.5 py-1.5 text-center">
                  <p className="font-mono text-base font-bold text-fuchsia-400 tabular-nums">
                    {String(value).padStart(2, "0")}
                  </p>
                  <p className="font-mono text-[8px] tracking-[0.2em] text-muted-foreground">
                    {unit}
                  </p>
                </div>
              ))}
            </div>
            <a
              href="/api/application/ics"
              download="nexus-interview.ics"
              className="inline-flex h-8 items-center gap-1.5 border border-fuchsia-400/50 bg-fuchsia-400/10 px-3 font-mono text-[10px] font-bold tracking-widest text-fuchsia-400 transition-colors hover:bg-fuchsia-400 hover:text-[#05080d]"
              title="Download a calendar file (.ics) with a 30-minute reminder"
            >
              <CalendarPlus className="h-3 w-3" aria-hidden="true" />
              ADD_TO_CALENDAR
            </a>
          </div>
        ) : (
          <p className="font-mono text-[10px] tracking-widest text-muted-foreground">
            slot in progress / elapsed
          </p>
        )}
      </div>
    </section>
  );
}

/**
 * Compact audit trail for the student - every review event the core team
 * has recorded, newest first. Hidden until there is history to show.
 */
function HistoryLog({ events }: { events: ApplicationRecord["statusHistory"] }) {
  if (!events || events.length < 2) return null; // single event == just submitted, no story yet
  return (
    <section className="terminal-panel" aria-label="Review history">
      <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          <History className="h-3 w-3" aria-hidden="true" />
          $ history --application
        </span>
        <span className="font-mono text-[9px] text-muted-foreground/60">
          {events.length} events
        </span>
      </div>
      <ol className="space-y-1.5 p-4">
        {[...events].reverse().map((event, i) => {
          const meta = getStatusMeta(event.status);
          const isStudentReply = event.by === "student";
          return (
            <li
              key={`${event.at}-${i}`}
              className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono text-[10px]"
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
                  isStudentReply ? "border-ok/50 bg-ok/10 text-ok" : meta.chipClass
                )}
              >
                {isStudentReply ? "YOUR_REPLY" : meta.label}
              </span>
              {event.note ? (
                <span className="max-w-full truncate text-muted-foreground/60" title={event.note}>
                  {event.note}
                </span>
              ) : null}
              {!isStudentReply ? <span className="text-muted-foreground/70">logged by core</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
