import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { isApplicationStatus, isInterviewMode, getStatusMeta } from "@/lib/status";
import { getDepartmentName, getDomainWhatsappGroupLink, DEFAULT_INTERVIEW_PANEL, normalizePanelName } from "@/lib/departments";
import {
  updateApplicationStatus,
  queueNotification,
  findInterviewConflicts,
  getApplicationById,
  getInterviewPanels,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  status: z.string().refine(isApplicationStatus, "Unknown status"),
  note: z.string().max(1000).optional().nullable(),
  /** ISO datetime of the interview slot (admins set it for status=SHORTLISTED) */
  interviewAt: z.string().max(40).optional().nullable(),
  /** GOOGLE_MEET | IN_PERSON | PHONE */
  interviewMode: z.string().max(20).optional().nullable(),
  /** interview panel running the slot ("Panel 1", "Panel 2", …) */
  interviewPanel: z.string().max(40).optional().nullable(),
  /** skip the interview-slot overlap guard (admin confirmed the double-booking) */
  force: z.boolean().optional(),
  /** admin-only internal note - never shown or emailed to the student */
  panelNote: z.string().max(1000).optional().nullable(),
});

/**
 * PATCH /api/admin/applications/[id]
 * Allowlist-gated review action: advance the application's status,
 * optionally attaching a note (interview slot, feedback, message to
 * student…). Every commit queues the student email in the outbox
 * (StatusNotification) - core flushes it manually from the outbox panel
 * (all or selected rows). Only submission receipts auto-send.
 * A SHORTLISTED commit without an interview slot is held back (no mail)
 * until the slot is added - response carries emailQueued for the console.
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

  // interview panel: explicit choice wins (validated against the roster),
  // otherwise keep the file's panel, otherwise the drive default. Only
  // meaningful for SHORTLISTED slots - other statuses leave it untouched.
  let interviewPanel: string | null | undefined;
  if (parsed.data.status === "SHORTLISTED" && interviewAt) {
    const panels = await getInterviewPanels();
    const explicit = normalizePanelName(parsed.data.interviewPanel);
    if (parsed.data.interviewPanel != null && explicit === null) {
      return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
    }
    if (explicit && !panels.includes(explicit)) {
      return NextResponse.json({ error: "UNKNOWN_PANEL" }, { status: 400 });
    }
    if (explicit) {
      interviewPanel = explicit;
    } else {
      const current = await getApplicationById(id);
      if (!current) {
        return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
      }
      interviewPanel =
        normalizePanelName(current.interviewPanel) ?? DEFAULT_INTERVIEW_PANEL;
    }
  }

  // overlap guard, scoped to the slot's panel: warn when another candidate
  // on the SAME panel already holds a slot within ±45min. Other panels may
  // run the same clock time in parallel. Force still double-books.
  if (parsed.data.status === "SHORTLISTED" && interviewAt && !parsed.data.force) {
    try {
      const conflicts = await findInterviewConflicts({
        excludeId: id,
        aroundIso: interviewAt,
        windowMinutes: 45,
        panel: interviewPanel ?? DEFAULT_INTERVIEW_PANEL,
      });
      if (conflicts.length > 0) {
        return NextResponse.json(
          {
            error: "SLOT_CONFLICT",
            message: `Another candidate on ${interviewPanel ?? DEFAULT_INTERVIEW_PANEL} already holds an interview slot within ±45 min of this one.`,
            panel: interviewPanel ?? DEFAULT_INTERVIEW_PANEL,
            conflicts: conflicts.map((c) => ({
              id: c.id,
              fullName: c.fullName,
              department: c.department,
              interviewAt: c.interviewAt,
              interviewMode: c.interviewMode,
              interviewPanel: c.interviewPanel,
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
      interviewPanel,
    });
    if (!updated) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    // Queue the student-facing email - core flushes the outbox manually
    // (FLUSH_QUEUE or FLUSH_SELECTED). Best-effort: a notification failure
    // must never block the review action.
    // Exception: a SHORTLISTED commit without an interview slot holds the
    // mail - the student is notified once the slot is actually added.
    const holdMail = parsed.data.status === "SHORTLISTED" && !interviewAt;
    let emailQueued = false;
    if (!holdMail) {
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
          // name the panel only on multi-panel drives - single-panel
          // drives keep the mail exactly as before.
          const panels = await getInterviewPanels();
          if (panels.length > 1 && updated.interviewPanel) {
            parts.push("", `Interview panel: ${updated.interviewPanel} - report there for your slot.`);
          }
        }
        if (parsed.data.status === "SHORTLISTED") {
          const groupLink = getDomainWhatsappGroupLink(updated.department);
          if (groupLink) {
            parts.push(
              "",
              `You are also invited to join the ${getDepartmentName(updated.department)} WhatsApp group: ${groupLink}`
            );
          }
        }
        parts.push("", "- NEXUS core team · VIT Chennai", "https://nexus.runs-on.dev");
        await queueNotification({
          applicationId: updated.id,
          email: updated.email,
          fullName: updated.fullName,
          type: "STATUS_CHANGE",
          subject: `[NEXUS '26] Application update - ${meta.label}`,
          body: parts.join("\n"),
        });
        emailQueued = true;
      } catch (notifyErr) {
        console.error("[api/admin/applications/:id] notification queue failed:", notifyErr);
      }
    }

    return NextResponse.json({ application: updated, emailQueued });
  } catch (err) {
    console.error("[api/admin/applications/:id] PATCH failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
