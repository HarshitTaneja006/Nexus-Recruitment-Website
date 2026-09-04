"use client";

import { useMemo, useRef, useState } from "react";
import {
  GraduationCap,
  Mail,
  User,
  Github,
  Linkedin,
  Globe,
  Trash2,
  AlertCircle,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  COMMON_QUESTIONS,
  DEPARTMENTS,
  EMPTY_LINKS,
  getDepartment,
  type Links,
  type Question,
} from "@/lib/departments";
import { DRIVE_DEADLINE, isDriveOpen } from "@/lib/drive";
import {
  buildAnswersSchema,
  whatsappSchema,
  zodErrorsToFieldMap,
} from "@/lib/validation";
import type { VitEmailProfile } from "@/lib/vit";
import { formatYearOfStudy } from "@/lib/vit";
import { useApplicationStore } from "@/store/application-store";
import { AutosaveIndicator, type SaveState } from "./autosave-indicator";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ApplicationResponse {
  id: string;
  submittedAt: string;
}

export function ApplicationForm({
  profile,
  onSubmitted,
}: {
  profile: VitEmailProfile;
  onSubmitted: (app: ApplicationResponse) => void;
}) {
  const department = useApplicationStore((s) => s.department);
  const whatsapp = useApplicationStore((s) => s.whatsapp);
  const answers = useApplicationStore((s) => s.answers);
  const links = useApplicationStore((s) => s.links);
  const updatedAt = useApplicationStore((s) => s.updatedAt);
  const serverSyncedAt = useApplicationStore((s) => s.serverSyncedAt);
  const setDepartment = useApplicationStore((s) => s.setDepartment);
  const setWhatsapp = useApplicationStore((s) => s.setWhatsapp);
  const setAnswer = useApplicationStore((s) => s.setAnswer);
  const setLink = useApplicationStore((s) => s.setLink);
  const reset = useApplicationStore((s) => s.reset);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [linkErrors, setLinkErrors] = useState<Record<string, string>>({});
  const [deptError, setDeptError] = useState<string | null>(null);
  const [waError, setWaError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveTick, setSaveTick] = useState(0);
  const formTopRef = useRef<HTMLDivElement | null>(null);

  const dept = getDepartment(department);

  /** Completion % across department + whatsapp + all required questions. */
  const progress = useMemo(() => {
    const items: { min: number; value: string }[] = [
      { min: 1, value: department },
      { min: 8, value: whatsapp.replace(/[^0-9]/g, "") },
    ];
    for (const q of COMMON_QUESTIONS) {
      items.push({ min: q.minLength ?? 1, value: answers[q.id] ?? "" });
    }
    for (const q of dept?.questions ?? []) {
      items.push({ min: q.minLength ?? 1, value: answers[q.id] ?? "" });
    }
    const filled = items.filter((i) => i.value.trim().length >= i.min).length;
    return Math.round((filled / items.length) * 100);
  }, [department, whatsapp, answers, dept]);

  /** Local validation of one field on blur. */
  const validateField = (q: Question, value: string) => {
    const trimmed = value.trim();
    if (trimmed.length > 0 && trimmed.length < (q.minLength ?? 1)) {
      setFieldErrors((e) => ({
        ...e,
        [q.id]: `Minimum ${q.minLength} characters - currently ${trimmed.length}`,
      }));
    } else {
      setFieldErrors((e) => {
        const next = { ...e };
        delete next[q.id];
        return next;
      });
    }
  };

  const validateWhatsapp = (value: string): boolean => {
    const check = whatsappSchema.safeParse(value.trim());
    if (!check.success) {
      setWaError(check.error.issues[0]?.message ?? "Enter a valid WhatsApp number");
      return false;
    }
    setWaError(null);
    return true;
  };

  const validateLinks = (): boolean => {
    const errors: Record<string, string> = {};
    const urlRe = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;
    (Object.keys(links) as (keyof Links)[]).forEach((k) => {
      const v = links[k].trim();
      if (v && !urlRe.test(v)) errors[k] = "Enter a valid URL (or leave empty)";
    });
    setLinkErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const scrollToFirstError = (errors: Record<string, string>) => {
    const firstId = Object.keys(errors)[0];
    if (!firstId) return;
    const el = document.getElementById(`q-${firstId}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    el?.focus({ preventScroll: true });
  };

  const handleInitiateSubmit = () => {
    if (!isDriveOpen()) {
      toast.error("DRIVE_CLOSED", { description: "The deadline has passed." });
      return;
    }
    if (!department) {
      setDeptError("Select the department you are applying to");
      document.getElementById("department-select")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      toast.error("Select a department first");
      return;
    }
    setDeptError(null);

    const waOk = validateWhatsapp(whatsapp);
    if (!waOk) {
      document.getElementById("whatsapp-input")?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      toast.error("WhatsApp number needed", {
        description: "The panel uses it for slot confirmations and quick calls.",
      });
      return;
    }

    let errors: Record<string, string> = {};
    const check = buildAnswersSchema(department).safeParse(answers);
    if (!check.success) {
      errors = zodErrorsToFieldMap(check.error);
    }
    const linksOk = validateLinks();

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !linksOk) {
      toast.error("VALIDATION_FAILED", {
        description: "Some answers are missing or too short - scroll to the highlighted fields.",
      });
      scrollToFirstError(errors);
      return;
    }
    setConfirmOpen(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ department, whatsapp: whatsapp.trim(), answers, links }),
      });
      if (res.status === 201) {
        const data = (await res.json()) as { application: ApplicationResponse };
        toast.success("APPLICATION_COMMITTED", {
          description: `ID: ${data.application.id}`,
        });
        reset();
        onSubmitted(data.application);
        return;
      }
      if (res.status === 400) {
        const data = (await res.json()) as { fields?: Record<string, string> };
        if (data.fields) {
          setFieldErrors(data.fields);
          scrollToFirstError(data.fields);
        }
        toast.error("VALIDATION_FAILED", {
          description: "The server flagged some fields - your answers are safe, fix and retry.",
        });
        return;
      }
      if (res.status === 423) {
        toast.error("DRIVE_CLOSED", { description: "The deadline has passed." });
        return;
      }
      throw new Error(`status ${res.status}`);
    } catch {
      // Data remains in localStorage + server draft - nothing is lost.
      setSaveState("error");
      setSaveTick((t) => t + 1);
      toast.error("TRANSMISSION_FAILED", {
        description: "Could not reach the server. Your answers are saved locally - just retry.",
      });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleDiscard = async () => {
    reset();
    try {
      await fetch("/api/application/draft", { method: "DELETE" });
    } catch {
      /* non-blocking */
    }
    toast("DRAFT_WIPED", { description: "Fresh start. rm -rf ~/draft" });
  };

  const deadlineLabel = DRIVE_DEADLINE.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Asia/Kolkata",
  });

  return (
    <div ref={formTopRef} className="space-y-6">
      {/* whoami - identity derived from email */}
      <section className="terminal-panel" aria-label="Your identity, derived from your email">
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ whoami - derived from your email
          </span>
          <AutosaveIndicator
            key={saveTick}
            state={saveState}
            localAt={updatedAt}
            serverAt={serverSyncedAt}
            className="hidden sm:inline-flex"
          />
        </div>
        <dl className="grid gap-px bg-border sm:grid-cols-3">
          <div className="flex items-start gap-3 bg-card px-4 py-3">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Name · derived
              </dt>
              <dd className="truncate font-mono text-sm text-foreground">{profile.fullName}</dd>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-card px-4 py-3">
            <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Year of study · derived
              </dt>
              <dd className="font-mono text-sm text-foreground">
                {formatYearOfStudy(profile.yearOfStudy)}{" "}
                <span className="text-muted-foreground/60">(joined {profile.joinYear})</span>
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-3 bg-card px-4 py-3">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <div className="min-w-0">
              <dt className="font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground">
                Email · verified
              </dt>
              <dd className="truncate font-mono text-sm text-foreground">{profile.email}</dd>
            </div>
          </div>
        </dl>
        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2">
          <span className="font-mono text-[10px] text-warn">
            ⚠ closes {deadlineLabel} IST
          </span>
          <AutosaveIndicator
            key={`m-${saveTick}`}
            state={saveState}
            localAt={updatedAt}
            serverAt={serverSyncedAt}
            className="sm:hidden"
          />
        </div>
      </section>

      {/* progress */}
      <section aria-label="Completion progress" className="terminal-panel px-4 py-3">
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
          <span>APPLICATION_PROGRESS</span>
          <span className="text-primary">{progress}%</span>
        </div>
        <div
          className="mt-2 h-3 border border-border bg-muted"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full bg-primary/80 transition-[width] duration-500"
            style={{
              width: `${progress}%`,
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(5,8,13,0.25) 0 4px, transparent 4px 8px)",
            }}
          />
        </div>
      </section>

      {/* whatsapp - required for panel contact */}
      <section className="terminal-panel" aria-label="WhatsApp contact number">
        <div className="flex items-center justify-between border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ phone --whatsapp · required
          </span>
          <span className="hidden border border-emerald-400/40 bg-emerald-400/10 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-emerald-400 sm:inline">
            PANEL CONTACT
          </span>
        </div>
        <div className="p-4">
          <label htmlFor="whatsapp-input" className="mb-2 flex items-center gap-1.5 font-mono text-xs text-foreground">
            <MessageCircle className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
            WHATSAPP NUMBER <span className="text-primary">*</span>
            <span className="ml-2 hidden text-[10px] text-muted-foreground sm:inline">
              slot confirmations & quick calls - never spammed
            </span>
          </label>
          <input
            id="whatsapp-input"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="+91 98765 43210"
            value={whatsapp}
            onChange={(e) => {
              setWhatsapp(e.target.value);
              if (waError) validateWhatsapp(e.target.value);
            }}
            onBlur={(e) => {
              if (e.target.value.trim()) validateWhatsapp(e.target.value);
            }}
            aria-invalid={Boolean(waError)}
            aria-describedby={waError ? "whatsapp-error" : "whatsapp-hint"}
            maxLength={20}
            className={cn(
              "h-11 w-full border bg-background/80 px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none",
              waError ? "border-destructive" : "border-input focus:border-emerald-400"
            )}
          />
          {waError ? (
            <p id="whatsapp-error" role="alert" className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {waError}
            </p>
          ) : (
            <p id="whatsapp-hint" className="mt-2 font-mono text-[10px] text-muted-foreground/60">
              include country code if possible - e.g. +91 for India
            </p>
          )}
        </div>
      </section>

      {/* department */}
      <section className="terminal-panel" aria-label="Choose your department">
        <div className="border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ select --department
          </span>
        </div>
        <div className="p-4">
          <label htmlFor="department-select" className="mb-2 block font-mono text-xs text-foreground">
            DEPARTMENT <span className="text-primary">*</span>
            <span className="ml-2 text-[10px] text-muted-foreground">
              one application · one domain · choose wisely
            </span>
          </label>
          <select
            id="department-select"
            value={department}
            onChange={(e) => {
              setDepartment(e.target.value);
              setDeptError(null);
              setFieldErrors({});
            }}
            aria-invalid={Boolean(deptError)}
            aria-describedby={deptError ? "department-error" : undefined}
            className={cn(
              "h-11 w-full border bg-background/80 px-3 font-mono text-sm text-foreground focus:outline-none focus:ring-0",
              deptError ? "border-destructive" : "border-input focus:border-primary"
            )}
          >
            <option value="" disabled>
              - select department -
            </option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>
                d {d.dir}/ - {d.name}
              </option>
            ))}
          </select>
          {deptError ? (
            <p id="department-error" className="mt-2 flex items-center gap-1.5 font-mono text-[11px] text-destructive">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> {deptError}
            </p>
          ) : null}
        </div>
      </section>

      {/* common questions */}
      <QuestionSection
        id="common"
        title={`$ cat common_kernel.q - everyone answers these`}
        questions={COMMON_QUESTIONS}
        answers={answers}
        errors={fieldErrors}
        onChange={(id, v) => {
          setAnswer(id, v);
          setFieldErrors((e) => {
            if (!e[id]) return e;
            const next = { ...e };
            delete next[id];
            return next;
          });
        }}
        onBlur={validateField}
      />

      {/* department questions */}
      {dept ? (
        <QuestionSection
          id={dept.id}
          title={`d ${dept.dir}/ - ${dept.name} questions`}
          accent={dept.accentClass}
          questions={dept.questions}
          answers={answers}
          errors={fieldErrors}
          onChange={(id, v) => {
            setAnswer(id, v);
            setFieldErrors((e) => {
              if (!e[id]) return e;
              const next = { ...e };
              delete next[id];
              return next;
            });
          }}
          onBlur={validateField}
        />
      ) : (
        <p className="border border-dashed border-border px-4 py-6 text-center font-mono text-xs text-muted-foreground">
          department questions unlock after you select a domain ↑
        </p>
      )}

      {/* links */}
      <section className="terminal-panel" aria-label="Portfolio links (optional)">
        <div className="border-b border-border bg-secondary/50 px-4 py-2">
          <span className="font-mono text-[10px] tracking-[0.2em] text-muted-foreground">
            $ open --links · optional, but they speak for you
          </span>
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-3">
          {(
            [
              { key: "github", label: "GITHUB", icon: Github, ph: "github.com/you" },
              { key: "linkedin", label: "LINKEDIN", icon: Linkedin, ph: "linkedin.com/in/you" },
              { key: "portfolio", label: "PORTFOLIO / DRIVE", icon: Globe, ph: "your.work" },
            ] as const
          ).map(({ key, label, icon: Icon, ph }) => (
            <div key={key}>
              <label htmlFor={`link-${key}`} className="mb-1.5 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" /> {label}
              </label>
              <input
                id={`link-${key}`}
                type="url"
                inputMode="url"
                placeholder={ph}
                value={links[key]}
                onChange={(e) => {
                  setLink(key, e.target.value);
                  setLinkErrors((er) => ({ ...er, [key]: "" }));
                }}
                aria-invalid={Boolean(linkErrors[key])}
                className={cn(
                  "h-10 w-full border bg-background/80 px-3 font-mono text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none",
                  linkErrors[key] ? "border-destructive" : "border-input focus:border-primary"
                )}
              />
              {linkErrors[key] ? (
                <p className="mt-1 font-mono text-[10px] text-destructive">{linkErrors[key]}</p>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {/* submit bar */}
      <section className="terminal-panel flex flex-col items-stretch gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleInitiateSubmit}
            disabled={submitting}
            className="inline-flex h-12 flex-1 items-center justify-center gap-2 border border-primary bg-primary px-6 font-mono text-sm font-bold tracking-widest text-primary-foreground shadow-[0_0_28px_rgba(96,165,250,0.3)] transition-all hover:shadow-[0_0_44px_rgba(96,165,250,0.5)] disabled:opacity-60 sm:flex-none"
          >
            {submitting ? "TRANSMITTING…" : "$ git commit -m 'apply'"}
          </button>
          <button
            type="button"
            onClick={handleDiscard}
            disabled={submitting}
            title="Wipe the saved draft and start fresh"
            className="inline-flex h-12 items-center gap-1.5 border border-border px-3 font-mono text-[10px] tracking-widest text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">rm -rf draft</span>
          </button>
        </div>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          answers auto-save locally + server mirror.
          <br className="hidden sm:block" /> re-submitting before the deadline overwrites your old version.
        </p>
      </section>

      {/* confirm dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="border-border bg-popover font-mono">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base tracking-wider">
              $ confirm --submit
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 font-sans text-sm">
                <p>
                  Transmit your application to{' '}
                  <span className="font-mono text-primary">
                    d {dept?.dir}/ - {dept?.name}
                  </span>
                  ?
                </p>
                <ul className="space-y-1 border border-border bg-background/60 p-3 font-mono text-xs text-muted-foreground">
                  <li>name: <span className="text-foreground">{profile.fullName}</span></li>
                  <li>year: <span className="text-foreground">{formatYearOfStudy(profile.yearOfStudy)}</span></li>
                  <li>email: <span className="text-foreground">{profile.email}</span></li>
                  <li>whatsapp: <span className="text-foreground">{whatsapp.trim()}</span></li>
                  <li>
                    department: <span className="text-foreground">{dept?.name}</span>
                  </li>
                </ul>
                <p className="text-muted-foreground">
                  You can edit and re-submit any time before the deadline.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border bg-transparent font-mono text-xs tracking-widest text-muted-foreground hover:text-foreground">
              KEEP_EDITING
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={submitting}
              className="bg-primary font-mono text-xs font-bold tracking-widest text-primary-foreground hover:bg-primary/90"
            >
              {submitting ? "TRANSMITTING…" : "CONFIRM_SUBMIT"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function QuestionSection({
  id,
  title,
  accent,
  questions,
  answers,
  errors,
  onChange,
  onBlur,
}: {
  id: string;
  title: string;
  accent?: string;
  questions: Question[];
  answers: Record<string, string>;
  errors: Record<string, string>;
  onChange: (id: string, value: string) => void;
  onBlur: (q: Question, value: string) => void;
}) {
  return (
    <section className="terminal-panel" aria-label={title}>
      <div className="border-b border-border bg-secondary/50 px-4 py-2">
        <span className={`font-mono text-[10px] tracking-[0.2em] ${accent ?? "text-muted-foreground"}`}>
          {title}
        </span>
      </div>
      <div className="divide-y divide-border">
        {questions.map((q, i) => {
          const value = answers[q.id] ?? "";
          const error = errors[q.id];
          const len = value.trim().length;
          const belowMin = Boolean(q.minLength && len > 0 && len < q.minLength);
          return (
            <div key={q.id} className="p-4" id={`q-${q.id}`}>
              <label htmlFor={`field-${q.id}`} className="flex items-baseline gap-2 font-mono text-[13px] leading-snug text-foreground">
                <span className="shrink-0 text-primary/80">
                  Q{String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  {q.label}
                  <span className="text-primary"> *</span>
                </span>
              </label>
              {q.hint ? (
                <p className="mt-1 pl-8 font-sans text-xs italic text-muted-foreground/80">
                  {q.hint}
                </p>
              ) : null}
              <div className="mt-2 pl-0 sm:pl-8">
                {q.type === "textarea" ? (
                  <textarea
                    id={`field-${q.id}`}
                    value={value}
                    rows={4}
                    maxLength={q.maxLength ?? 1200}
                    placeholder={q.placeholder}
                    onChange={(e) => onChange(q.id, e.target.value)}
                    onBlur={(e) => onBlur(q, e.target.value)}
                    aria-invalid={Boolean(error)}
                    aria-describedby={`${q.id}-meta ${error ? `${q.id}-error` : ""}`}
                    className={cn(
                      "w-full resize-y border bg-background/80 px-3 py-2 font-sans text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/40 focus:outline-none",
                      error ? "border-destructive" : belowMin ? "border-warn/60" : "border-input focus:border-primary"
                    )}
                  />
                ) : (
                  <input
                    id={`field-${q.id}`}
                    value={value}
                    maxLength={q.maxLength ?? 200}
                    placeholder={q.placeholder}
                    onChange={(e) => onChange(q.id, e.target.value)}
                    onBlur={(e) => onBlur(q, e.target.value)}
                    aria-invalid={Boolean(error)}
                    className={cn(
                      "h-10 w-full border bg-background/80 px-3 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none",
                      error ? "border-destructive" : "border-input focus:border-primary"
                    )}
                  />
                )}
                <div className="mt-1 flex items-center justify-between gap-2">
                  <span id={`${q.id}-meta`} className="font-mono text-[10px] text-muted-foreground/70">
                    {q.minLength ? `min ${q.minLength}` : "optional"} · {len}/{q.maxLength ?? 1200}
                  </span>
                  {error ? (
                    <span id={`${q.id}-error`} role="alert" className="font-mono text-[10px] text-destructive">
                      ✗ {error}
                    </span>
                  ) : belowMin ? (
                    <span className="font-mono text-[10px] text-warn">
                      keep typing - {q.minLength! - len} more characters
                    </span>
                  ) : len >= (q.minLength ?? Infinity) ? (
                    <span className="ok-text font-mono text-[10px]">✓ ok</span>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { EMPTY_LINKS };
