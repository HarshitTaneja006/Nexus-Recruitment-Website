"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  FileText,
  Github,
  Rocket,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import type { ApplicationRecord } from "@/lib/storage";
import {
  TECH_ROUND1_BRIEF_URL,
  formatRound1Deadline,
  round1MsRemaining,
} from "@/lib/tech-round1";
import { cn } from "@/lib/utils";

interface Round1State {
  githubUrl: string;
  reportUrl: string;
  deployUrl: string;
}

/**
 * Tech Round 1 screen (status = SHORTLISTED_R1, technical only).
 * No interview slot on this round - just the project brief PDF, the
 * deadline countdown, and the hand-in form (github + report required,
 * deploy optional). Re-submits overwrite until the deadline.
 */
export function TechRound1Panel({
  application: initial,
  deadline: initialDeadline,
  compact = false,
}: {
  application: ApplicationRecord;
  deadline: string | null;
  compact?: boolean;
}) {
  const [application, setApplication] = useState(initial);
  const [deadline, setDeadline] = useState<string | null>(initialDeadline);
  const [form, setForm] = useState<Round1State>({
    githubUrl: initial.round1GithubUrl ?? "",
    reportUrl: initial.round1ReportUrl ?? "",
    deployUrl: initial.round1DeployUrl ?? "",
  });
  const [errors, setErrors] = useState<Partial<Round1State>>({});
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // refresh deadline + submission state (poll every 60s, cheap)
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/round1", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          application: ApplicationRecord;
          deadline: string | null;
        };
        if (!alive) return;
        setApplication((prev) => ({ ...prev, ...data.application }));
        setDeadline(data.deadline);
        setForm((f) => ({
          githubUrl: f.githubUrl || data.application.round1GithubUrl || "",
          reportUrl: f.reportUrl || data.application.round1ReportUrl || "",
          deployUrl: f.deployUrl || data.application.round1DeployUrl || "",
        }));
      } catch {
        /* offline - last known state stays */
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // live countdown ticker (only while a deadline exists)
  useEffect(() => {
    if (!deadline) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    setNow(Date.now());
    return () => clearInterval(id);
  }, [deadline]);

  const remaining = round1MsRemaining(deadline, now ?? Date.now());
  const closed = remaining !== null && remaining <= 0;
  const submitted = Boolean(application.round1SubmittedAt);

  const countdown =
    remaining !== null && remaining > 0
      ? ([
          ["D", Math.floor(remaining / 86_400_000)],
          ["H", Math.floor((remaining / 3_600_000) % 24)],
          ["M", Math.floor((remaining / 60_000) % 60)],
          ["S", Math.floor((remaining / 1_000) % 60)],
        ] as [string, number][])
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || closed) return;
    setErrors({});
    const next: Partial<Round1State> = {};
    if (!form.githubUrl.trim()) next.githubUrl = "Paste your GitHub repo link";
    if (!form.reportUrl.trim()) next.reportUrl = "Paste your report link";
    if (
      form.deployUrl.trim() &&
      !/^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(form.deployUrl.trim())
    )
      next.deployUrl = "Enter a valid URL or leave it empty";
    if (next.githubUrl || next.reportUrl || next.deployUrl) {
      setErrors(next);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/round1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubUrl: form.githubUrl.trim(),
          reportUrl: form.reportUrl.trim(),
          deployUrl: form.deployUrl.trim() || "",
        }),
      });
      if (res.status === 423) {
        toast.error("ROUND1_CLOSED", { description: "The deadline passed - hand-in is locked." });
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { application: ApplicationRecord };
      setApplication((prev) => ({ ...prev, ...data.application }));
      toast.success(submitted ? "ROUND1_UPDATED" : "ROUND1_SUBMITTED", {
        description: submitted
          ? "Links overwritten - the latest version counts."
          : "Build received - you can still overwrite it until the deadline.",
      });
    } catch {
      toast.error("SUBMIT_FAILED", { description: "Could not save - try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section
      className="terminal-panel border-cyan-300/40"
      aria-label="Technical Round 1 - project submission"
    >
      <div className="flex items-center justify-between border-b border-cyan-300/30 bg-cyan-300/10 px-4 py-2">
        <span className="font-mono text-[10px] tracking-[0.2em] text-cyan-300">
          $ round1 --project
        </span>
        <span className="font-mono text-[9px] tracking-widest text-cyan-300/80">
          {closed ? "LOCKED" : submitted ? "SUBMITTED · EDITABLE" : "ACTION_NEEDED"}
        </span>
      </div>

      <div className="space-y-4 p-5">
        <div>
          <p className="font-mono text-sm font-bold tracking-wide text-foreground">
            SHORTLISTED_FOR_ROUND_1
          </p>
          <p className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
            No interview slot on this round. Build the brief, push it to
            GitHub, write the report, and hand both in below before the
            deadline. Clear this and you move to Round 2 (interview).
          </p>
        </div>

        {/* brief + deadline */}
        <div className="grid gap-3 sm:grid-cols-2">
          <a
            href={TECH_ROUND1_BRIEF_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 border border-cyan-300/40 bg-cyan-300/5 px-4 py-3 transition-colors hover:bg-cyan-300/15"
          >
            <FileText className="h-6 w-6 shrink-0 text-cyan-300" aria-hidden="true" />
            <span>
              <span className="block font-mono text-xs font-bold tracking-widest text-cyan-300">
                READ_THE_BRIEF
                <ExternalLink className="ml-1.5 inline h-3 w-3" aria-hidden="true" />
              </span>
              <span className="mt-0.5 block font-mono text-[9px] text-muted-foreground">
                tech-round1-brief.pdf · if this 404s the PDF isn&apos;t uploaded yet - check the
                WhatsApp group
              </span>
            </span>
          </a>
          <div className="flex items-center gap-3 border border-border bg-secondary/40 px-4 py-3">
            <CalendarClock className="h-6 w-6 shrink-0 text-warn" aria-hidden="true" />
            <span>
              <span className="block font-mono text-xs font-bold tracking-wide text-foreground">
                {formatRound1Deadline(deadline)}
              </span>
              <span className="mt-0.5 block font-mono text-[9px] tracking-widest text-muted-foreground">
                DEADLINE_IST · {closed ? "passed - hand-in locked" : "re-submits overwrite"}
              </span>
            </span>
          </div>
        </div>

        {countdown ? (
          <div
            className="grid max-w-xs grid-cols-4 gap-px border border-cyan-300/40 bg-cyan-300/40"
            role="timer"
            aria-label="Time remaining for the Round 1 deadline"
          >
            {countdown.map(([unit, value]) => (
              <div key={unit} className="bg-card px-2.5 py-1.5 text-center">
                <p className="font-mono text-base font-bold tabular-nums text-cyan-300">
                  {String(value).padStart(2, "0")}
                </p>
                <p className="font-mono text-[8px] tracking-[0.2em] text-muted-foreground">{unit}</p>
              </div>
            ))}
          </div>
        ) : null}

        {closed ? (
          <p
            className="border border-warn/50 bg-warn/10 px-4 py-3 font-mono text-[11px] leading-relaxed text-warn"
            role="status"
          >
            Deadline passed - your last submission
            {submitted ? " is locked in for review." : " window closed with nothing on file."}
          </p>
        ) : null}

        {/* hand-in form */}
        <form onSubmit={submit} className="space-y-3" aria-label="Round 1 submission form">
          <Round1Field
            icon={<Github className="h-3.5 w-3.5" aria-hidden="true" />}
            label="GITHUB_LINK · required"
            value={form.githubUrl}
            error={errors.githubUrl}
            disabled={closed || saving}
            placeholder="https://github.com/you/round1-build"
            onChange={(v) => setForm((f) => ({ ...f, githubUrl: v }))}
          />
          <Round1Field
            icon={<FileText className="h-3.5 w-3.5" aria-hidden="true" />}
            label="REPORT_LINK · required"
            value={form.reportUrl}
            error={errors.reportUrl}
            disabled={closed || saving}
            placeholder="https://drive.google.com/… or docs / pdf url"
            onChange={(v) => setForm((f) => ({ ...f, reportUrl: v }))}
          />
          <Round1Field
            icon={<Rocket className="h-3.5 w-3.5" aria-hidden="true" />}
            label="DEPLOY_LINK · optional"
            value={form.deployUrl}
            error={errors.deployUrl}
            disabled={closed || saving}
            placeholder="https://your-demo.vercel.app (leave empty if none)"
            onChange={(v) => setForm((f) => ({ ...f, deployUrl: v }))}
          />
          {!closed ? (
            <button
              type="submit"
              disabled={saving}
              className={cn(
                "inline-flex h-11 w-full items-center justify-center gap-2 border px-5 font-mono text-xs font-bold tracking-widest transition-colors",
                "border-cyan-300/60 bg-cyan-300/15 text-cyan-300 hover:bg-cyan-300 hover:text-[#05080d]",
                saving && "cursor-wait opacity-60"
              )}
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              {saving ? "PUSHING…" : submitted ? "RESUBMIT_ROUND1" : "SUBMIT_ROUND1"}
            </button>
          ) : null}
        </form>

        {submitted ? (
          <p className="flex items-start gap-2 border border-ok/40 bg-ok/5 px-4 py-3 font-sans text-xs leading-relaxed text-foreground/90">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ok" aria-hidden="true" />
            <span>
              Last hand-in{" "}
              {application.round1SubmittedAt
                ? new Date(application.round1SubmittedAt).toLocaleString("en-IN", {
                    timeZone: "Asia/Kolkata",
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  }) + " IST"
                : "recorded"}
              . Re-submitting overwrites it{closed ? "" : " until the deadline"}.
            </span>
          </p>
        ) : null}

        {!compact ? (
          <Link
            href="/apply"
            className="inline-flex font-mono text-[10px] tracking-widest text-muted-foreground hover:text-primary"
          >
            ← BACK_TO_RECEIPT
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function Round1Field({
  icon,
  label,
  value,
  error,
  disabled,
  placeholder,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  error?: string;
  disabled?: boolean;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
        {icon}
        {label}
      </span>
      <input
        type="url"
        inputMode="url"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={cn(
          "mt-1.5 h-10 w-full border bg-background/80 px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none",
          error ? "border-destructive" : "border-input focus:border-cyan-300"
        )}
      />
      {error ? <span className="mt-1 block font-mono text-[10px] text-destructive">{error}</span> : null}
    </label>
  );
}
