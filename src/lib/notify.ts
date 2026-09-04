import { DRIVE_DEADLINE } from "@/lib/drive";
import {
  listDraftReminderCandidates,
  hasRecentNotification,
  queueNotification,
} from "@/lib/storage";
import { getDepartmentName } from "@/lib/departments";

/**
 * Deadline-near reminder sweep: students with a saved draft but no
 * submission get a nudge while the window can still be caught.
 *
 * Idempotent: each student is reminded at most once every 48h. Called
 * automatically by the outbox drain inside the reminder window, and
 * on-demand from the outbox panel (REMIND_DRAFTS button).
 */

/** The sweep only fires automatically within this many days of the deadline. */
export const REMINDER_WINDOW_DAYS = 7;
/** Per-student dedupe window. */
const REMINDER_DEDUPE_MS = 48 * 60 * 60 * 1000;

export function isReminderWindowOpen(now = new Date()): boolean {
  const diff = DRIVE_DEADLINE.getTime() - now.getTime();
  return diff > 0 && diff <= REMINDER_WINDOW_DAYS * 86_400_000;
}

export function daysUntilDeadline(now = new Date()): number {
  return Math.max(
    0,
    Math.ceil((DRIVE_DEADLINE.getTime() - now.getTime()) / 86_400_000)
  );
}

/** Queue DRAFT_REMINDER mail for every eligible draft-only student. */
export async function queueDraftReminderSweep(): Promise<number> {
  if (DRIVE_DEADLINE.getTime() <= Date.now()) return 0; // window shut - nobody can act

  const candidates = await listDraftReminderCandidates();
  let queued = 0;
  for (const c of candidates) {
    if (await hasRecentNotification(c.email, "DRAFT_REMINDER", REMINDER_DEDUPE_MS)) {
      continue;
    }
    const days = daysUntilDeadline();
    const dept = c.department ? ` (${getDepartmentName(c.department)})` : "";
    const lines = [
      `Hi ${c.fullName ?? "there"},`,
      "",
      `Your NEXUS Recruitments '26 draft${dept} is still sitting in the outbox - and the window closes in ~${days} day${days === 1 ? "" : "s"} (24 Sep 2026, 23:59 IST).`,
      "",
      "Your answers were auto-saved, so picking up where you left off takes one click:",
      "  → sign in at https://nexus.runs-on.dev/apply and hit submit.",
      "",
      "No draft? You can still start fresh - but do it before the deadline.",
      "",
      "- NEXUS core team · VIT Chennai",
    ];
    await queueNotification({
      applicationId: `draft:${c.email}`, // synthetic id - no application exists yet
      email: c.email,
      fullName: c.fullName ?? "Applicant",
      type: "DRAFT_REMINDER",
      subject: `[NEXUS '26] Your application is one click away - ${days} day${days === 1 ? "" : "s"} left`,
      body: lines.join("\n"),
    });
    queued += 1;
  }
  return queued;
}
