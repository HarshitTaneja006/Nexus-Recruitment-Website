/**
 * Application status model - the review pipeline.
 *
 * Admins move applications along this flow from the review console;
 * students see a live pipeline of the same stages on their receipt.
 *
 *   SUBMITTED → SHORTLISTED → DECISION
 *                                ├→ ACCEPTED
 *                                ├→ WAITLISTED
 *                                └→ REJECTED
 *
 * Interview slots (interviewAt/interviewMode) attach to SHORTLISTED -
 * shortlisting doubles as "invited to interview".
 *
 * Legacy aliases (IN_REVIEW / NEEDS_INFO / INTERVIEW) exist for DISPLAY
 * ONLY: old audit-trail entries keep rendering truthfully, but they are
 * not selectable states and the API rejects them.
 */

export const APPLICATION_STATUSES = [
  "SUBMITTED",
  "SHORTLISTED",
  "WAITLISTED",
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
export const LEGACY_STATUSES = ["IN_REVIEW", "NEEDS_INFO", "INTERVIEW"] as const;

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
  WAITLISTED: {
    label: "WAITLISTED",
    textClass: "text-warn",
    chipClass: "border-warn/50 bg-warn/10 text-warn",
    barClass: "bg-warn",
    studentCopy:
      "Strong application - you're on the reserve list. Seats may open as cycles settle.",
    adminHint: "backup pool - may be pulled up later",
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
};

/** Ordered pipeline stages for the student-facing progress visualization.
 *  The final stage is a virtual "DECISION" placeholder (ACCEPTED | WAITLISTED | REJECTED). */
export const STATUS_PIPELINE: string[] = [
  "SUBMITTED",
  "SHORTLISTED",
  "DECISION",
];

/** Terminal statuses that end the pipeline. */
export const TERMINAL_STATUSES: ApplicationStatus[] = [
  "ACCEPTED",
  "WAITLISTED",
  "REJECTED",
];

export function isTerminalStatus(s: string): boolean {
  return TERMINAL_STATUSES.includes(s as ApplicationStatus);
}

/**
 * Index of the app's current stage on the pipeline (0..2).
 * Legacy review-stage statuses map onto SUBMITTED (they were branches of
 * screening, not their own step); terminals map to the final DECISION stage.
 */
export function pipelineStageIndex(status: string): number {
  if (isTerminalStatus(status)) return STATUS_PIPELINE.length - 1;
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
