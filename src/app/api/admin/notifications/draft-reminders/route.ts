import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { DRIVE_DEADLINE } from "@/lib/drive";
import {
  queueDraftReminderSweep,
  isReminderWindowOpen,
  daysUntilDeadline,
} from "@/lib/notify";
import {
  listDraftReminderCandidates,
  hasRecentNotification,
  queueNotification,
} from "@/lib/storage";
import { getDepartmentName } from "@/lib/departments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** queue for every candidate even inside the 48h dedupe window */
  force: z.boolean().optional(),
});

function reminderBody(fullName: string | null, deptSuffix: string, days: number): string {
  return [
    `Hi ${fullName ?? "there"},`,
    "",
    `Your NEXUS Recruitments '26 draft${deptSuffix} is still sitting in the outbox — the window closes in ~${days} day${days === 1 ? "" : "s"} (24 Sep 2026, 23:59 IST).`,
    "",
    "Your answers were auto-saved, so picking up where you left off takes one click:",
    "  → sign in at https://nexus.runs-on.dev/apply and hit submit.",
    "",
    "No draft? You can still start fresh — but do it before the deadline.",
    "",
    "— NEXUS core team · VIT Chennai",
  ].join("\n");
}

/**
 * POST /api/admin/notifications/draft-reminders
 * Queue deadline-near reminder emails for students whose draft was
 * auto-saved but who never submitted. Deduped per student (48h) unless
 * {force:true}. Returns the candidate/queued split for the console toast.
 */
export async function POST(req: Request) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let raw: unknown = {};
  try {
    const text = await req.text();
    if (text.trim()) raw = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  try {
    if (DRIVE_DEADLINE.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "DRIVE_CLOSED", message: "The deadline has passed — nobody left to remind." },
        { status: 423 }
      );
    }

    const candidates = await listDraftReminderCandidates();
    const days = daysUntilDeadline();

    if (parsed.data.force) {
      let forced = 0;
      for (const c of candidates) {
        const suffix = c.department ? ` (${getDepartmentName(c.department)})` : "";
        await queueNotification({
          applicationId: `draft:${c.email}`, // synthetic id — no application yet
          email: c.email,
          fullName: c.fullName ?? "Applicant",
          type: "DRAFT_REMINDER",
          subject: `[NEXUS '26] Your application is one click away — ${days} day${days === 1 ? "" : "s"} left`,
          body: reminderBody(c.fullName, suffix, days),
        });
        forced += 1;
      }
      return NextResponse.json({ queued: forced, candidates: candidates.length, forced: true });
    }

    const queued = await queueDraftReminderSweep();
    let deduped = 0;
    for (const c of candidates) {
      if (await hasRecentNotification(c.email, "DRAFT_REMINDER", 48 * 60 * 60 * 1000)) {
        deduped += 1;
      }
    }
    return NextResponse.json({
      queued,
      candidates: candidates.length,
      deduped,
      windowOpen: isReminderWindowOpen(),
      daysLeft: days,
    });
  } catch (err) {
    console.error("[api/admin/notifications/draft-reminders] POST failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
