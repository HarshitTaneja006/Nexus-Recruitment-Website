import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { isApplicationStatus, isInterviewMode, getStatusMeta } from "@/lib/status";
import {
  updateApplicationStatus,
  findInterviewConflicts,
} from "@/lib/storage";
import { deliverNotificationNow } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.string().refine(isApplicationStatus, "Unknown status"),
  note: z.string().max(1000).optional().nullable(),
  /** ISO datetime of the interview slot (admins set it for status=SHORTLISTED) */
  interviewAt: z.string().max(40).optional().nullable(),
  /** GOOGLE_MEET | IN_PERSON | PHONE */
  interviewMode: z.string().max(20).optional().nullable(),
  /** skip the interview-slot overlap guard (admin confirmed the double-booking) */
  force: z.boolean().optional(),
  /** admin-only internal note - never shown or emailed to the student */
  panelNote: z.string().max(1000).optional().nullable(),
});

/**
 * PATCH /api/admin/applications/[id]
 * Allowlist-gated review action: advance the application's status,
 * optionally attaching a note (interview slot, feedback, message to
 * student…). Every commit also emails the student directly over SMTP
 * (recorded SENT/FAILED in the outbox for history - never QUEUED).
 */
export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  // interview slot sanity: must parse, must be a valid mode when present
  const interviewAt =
    parsed.data.interviewAt && !Number.isNaN(Date.parse(parsed.data.interviewAt))
      ? new Date(parsed.data.interviewAt).toISOString()
      : null;
  const interviewMode =
    parsed.data.interviewMode && isInterviewMode(parsed.data.interviewMode)
      ? parsed.data.interviewMode
      : null;

  // one panel, no overlaps: warn when another candidate already holds a slot
  // within ±45min. The admin can still force the commit (SLOT_CONFLICT → 409).
  if (parsed.data.status === "SHORTLISTED" && interviewAt && !parsed.data.force) {
    try {
      const conflicts = await findInterviewConflicts({
        excludeId: id,
        aroundIso: interviewAt,
        windowMinutes: 45,
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: "SLOT_CONFLICT",
            message:
              "Another candidate already holds an interview slot within ±45 min of this one.",
            conflicts: conflicts.map((c) => ({
              id: c.id,
              fullName: c.fullName,
              department: c.department,
              interviewAt: c.interviewAt,
              interviewMode: c.interviewMode,
            })),
          },
          { status: 409 }
        );
      }
    } catch (conflictErr) {
      // a conflict-check failure must not block the review action
      console.error("[api/admin/applications/:id] conflict check failed:", conflictErr);
    }
  }

  try {
    const updated = await updateApplicationStatus({
      id,
      status: parsed.data.status,
      note: parsed.data.note?.trim() ? parsed.data.note.trim() : null,
      panelNote:
        parsed.data.panelNote === undefined
          ? undefined
          : parsed.data.panelNote?.trim()
            ? parsed.data.panelNote.trim()
            : null,
      reviewedBy: adminEmail,
      interviewAt,
      interviewMode,
    });
    if (!updated) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Direct delivery: the student gets the email over SMTP right away.
    // Best-effort: a notification failure must never block the review action.
    try {
      const meta = getStatusMeta(parsed.data.status);
      const parts = [
        `Hi ${updated.fullName},`,
        "",
        `Your NEXUS Recruitments '26 application (d ${updated.department}/) moved to ${meta.label}.`,
        "",
        meta.studentCopy,
      ];
      if (updated.statusNote) parts.push("", `Note from the core team: ${updated.statusNote}`);
      if (interviewAt) {
        parts.push(
          "",
          `Interview slot: ${new Date(interviewAt).toLocaleString("en-IN", {
            timeZone: "Asia/Kolkata",
            weekday: "long",
            day: "2-digit",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          })} IST${interviewMode ? ` · ${interviewMode}` : ""}`
        );
      }
      parts.push("", "- NEXUS core team · VIT Chennai", "https://nexus.runs-on.dev");
      await deliverNotificationNow({
        applicationId: updated.id,
        email: updated.email,
        fullName: updated.fullName,
        type: "STATUS_CHANGE",
        subject: `[NEXUS '26] Application update - ${meta.label}`,
        text: parts.join("\n"),
      });
    } catch (notifyErr) {
      console.error("[api/admin/applications/:id] notification delivery failed:", notifyErr);
    }

    return NextResponse.json({ application: updated });
  } catch (err) {
    console.error("[api/admin/applications/:id] PATCH failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
