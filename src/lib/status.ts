/**
 * Application status model - the review pipeline.
 *
 * Admins move applications along this flow from the review console;
 * students see a live pipeline of the same stages on their receipt.
 *
 *   SUBMITTED → SHORTLISTED → INTERVIEWED → DECISION
 *                                               ├→ ACCEPTED
 *                                               └→ REJECTED
 *
 * Interview slots (interviewAt/interviewMode) attach to SHORTLISTED -
 * shortlisting doubles as "invited to interview"; INTERVIEWED marks the
 * interview as done and the file as awaiting a final decision.
 *
 * Legacy aliases (IN_REVIEW / NEEDS_INFO / INTERVIEW / WAITLISTED) exist for
 * DISPLAY ONLY: old audit-trail entries keep rendering truthfully, but they
 * are not selectable states and the API rejects them.
 */

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SHORTLISTED",
  "INTERVIEWED",
  "ACCEPTED",
  "REJECTED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export function isApplicationStatus(v: unknown): v is ApplicationStatus {
  return (
    typeof v === "string" &&
    (APPLICATION_STATUSES as readonly string[]).includes(v)
  );
}

/** Historic statuses that may still appear inside statusHistory JSON. */
export const LEGACY_STATUSES = [
  "IN_REVIEW",
  "NEEDS_INFO",
  "INTERVIEW",
  "WAITLISTED",
] as const;

interface StatusMeta {
  /** short label shown in badges */
  label: string;
  /** tailwind text color class */
  textClass: string;
  /** tailwind bg chip class (border + bg + text together) */
  chipClass: string;
  /** hex-ish inline color for bars/dots (must be a tailwind bg-*) */
  barClass: string;
  /** student-facing one-liner */
  studentCopy: string;
  /** admin-facing hint in the status editor */
  adminHint: string;
}

export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  SUBMITTED: {
    label: "SUBMITTED",
    textClass: "text-primary",
    chipClass: "border-primary/50 bg-primary/10 text-primary",
    barClass: "bg-sky-400",
    studentCopy:
      "Transmission received. Your application is queued for the domain leads - nothing else is needed from you right now.",
    adminHint: "default state - not touched yet",
  },
  SHORTLISTED: {
    label: "SHORTLISTED",
    textClass: "text-emerald-400",
    chipClass: "border-emerald-400/50 bg-emerald-400/10 text-emerald-400",
    barClass: "bg-emerald-400",
    studentCopy:
      "You cleared the first cut. Shortlisted - interview details (if any) appear in the slot card below.",
    adminHint: "cleared screening - attach the interview slot + mode here",
  },
  INTERVIEWED: {
    label: "INTERVIEWED",
    textClass: "text-violet-400",
    chipClass: "border-violet-400/50 bg-violet-400/10 text-violet-400",
    barClass: "bg-violet-400",
    studentCopy:
      "Interview done. The panel is deliberating - your decision lands here and in your inbox.",
    adminHint: "interview complete - deliberating, decide next",
  },
  ACCEPTED: {
    label: "ACCEPTED",
    textClass: "text-ok",
    chipClass: "border-ok/50 bg-ok/10 text-ok",
    barClass: "bg-emerald-400",
    studentCopy:
      "Welcome to the collective. Check your email for onboarding - your first build night is waiting.",
    adminHint: "offer sent - final state",
  },
  REJECTED: {
    label: "REJECTED",
    textClass: "text-destructive",
    chipClass: "border-destructive/50 bg-destructive/10 text-destructive",
    barClass: "bg-destructive",
    studentCopy:
      "This cycle ends here - that says nothing about your skill. Re-apply next cycle; the door stays open.",
    adminHint: "closed for this cycle - be kind, it happens",
  },
};

/**
 * Display-only meta for statuses that can still appear in old audit trails.
 * Deliberately NOT part of APPLICATION_STATUSES - the API and the admin
 * status editor never offer these.
 */
export const LEGACY_STATUS_META: Record<string, StatusMeta> = {
  IN_REVIEW: {
    label: "IN_REVIEW",
    textClass: "text-amber-400",
    chipClass: "border-amber-400/50 bg-amber-400/10 text-amber-400",
    barClass: "bg-amber-400",
    studentCopy: "",
    adminHint: "legacy stage - resolved to SUBMITTED",
  },
  NEEDS_INFO: {
    label: "NEEDS_INFO",
    textClass: "text-orange-400",
    chipClass: "border-orange-400/50 bg-orange-400/10 text-orange-400",
    barClass: "bg-orange-400",
    studentCopy: "",
    adminHint: "legacy stage - resolved to SUBMITTED",
  },
  INTERVIEW: {
    label: "INTERVIEW",
    textClass: "text-fuchsia-400",
    chipClass: "border-fuchsia-400/50 bg-fuchsia-400/10 text-fuchsia-400",
    barClass: "bg-fuchsia-400",
    studentCopy: "",
    adminHint: "legacy stage - resolved to SHORTLISTED",
  },
  WAITLISTED: {
    label: "WAITLISTED",
    textClass: "text-warn",
    chipClass: "border-warn/50 bg-warn/10 text-warn",
    barClass: "bg-warn",
    studentCopy: "",
    adminHint: "legacy stage - retired, no longer selectable",
  },
};

/** Ordered pipeline stages for the student-facing progress visualization.
 *  The final stage is a virtual "DECISION" placeholder (ACCEPTED | REJECTED). */
export const STATUS_PIPELINE: string[] = [
  "SUBMITTED",
  "SHORTLISTED",
  "INTERVIEWED",
  "DECISION",
];

/** Terminal statuses that end the pipeline. */
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  "ACCEPTED",
  "REJECTED",
];

export function isTerminalStatus(s: string): boolean {
  return TERMINAL_STATUSES.includes(s as ApplicationStatus);
}

/**
 * Index of the app's current stage on the pipeline (0..3).
 * Legacy review-stage statuses map onto SUBMITTED (they were branches of
 * screening, not their own step); terminals map to the final DECISION stage.
 */
export function pipelineStageIndex(status: string): number {
  if (isTerminalStatus(status)) return STATUS_PIPELINE.length - 1;
  if (status === "INTERVIEWED") return 2;
  if (status === "SHORTLISTED") return 1;
  return 0;
}

export function getStatusMeta(status: string): StatusMeta {
  const canonical = STATUS_META[status as ApplicationStatus];
  if (canonical) return canonical;
  return LEGACY_STATUS_META[status] ?? STATUS_META.SUBMITTED;
}

/** Label for any status incl. legacy - falls back to the raw string. */
export function getStatusLabel(status: string): string {
  return getStatusMeta(status).label;
}

/* ------------------------------------------------------------------ */
/* Interview scheduling (slots attach to SHORTLISTED)                  */
/* ------------------------------------------------------------------ */

export const INTERVIEW_MODES = ["GOOGLE_MEET", "IN_PERSON", "PHONE"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_MODE_META: Record<
  InterviewMode,
  { label: string; hint: string }
> = {
  GOOGLE_MEET: { label: "GOOGLE_MEET", hint: "online - link goes in the note" },
  IN_PERSON: { label: "IN_PERSON", hint: "campus - venue goes in the note" },
  PHONE: { label: "PHONE", hint: "we call the WhatsApp number on record" },
};

export function isInterviewMode(v: unknown): v is InterviewMode {
  return (
    typeof v === "string" &&
    (INTERVIEW_MODES as readonly string[]).includes(v)
  );
}

/** One entry in an application's review audit trail. */
export interface StatusEvent {
  status: string;
  note: string | null;
  by: string;
  at: string; // ISO timestamp
}

export function parseStatusHistory(raw: unknown): StatusEvent[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is Record<string, unknown> =>
        typeof e === "object" && e !== null && "status" in e
    )
    .map((e) => ({
      status: String(e.status),
      note: e.note == null ? null : String(e.note),
      by: String(e.by ?? "core"),
      at: String(e.at ?? new Date().toISOString()),
    }));
}
