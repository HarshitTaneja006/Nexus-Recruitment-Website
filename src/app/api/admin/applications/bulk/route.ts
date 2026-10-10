import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import {
  isApplicationStatus,
  isInterviewMode,
  getStatusMeta,
  isSlottedShortlistStatus,
} from "@/lib/status";
import {
  getDepartment,
  getDepartmentName,
  getDomainWhatsappGroupLink,
  DEFAULT_INTERVIEW_PANEL,
  normalizePanelName,
  resolveSlotPanel,
} from "@/lib/departments";
import { NEXUS_COMMUNITY_ENV_KEY, getNexusCommunityLink } from "@/lib/community";
import { certificatePathForWhatsapp, CERTIFICATE_BUCKET } from "@/lib/certificates";
import {
  listApplications,
  queueNotification,
  updateApplicationStatus,
  findInterviewConflicts,
  getInterviewPanels,
  getTechRound1Deadline,
  type ApplicationRecord,
} from "@/lib/storage";
import { TECH_ROUND1_BRIEF_URL } from "@/lib/tech-round1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Hard cap per request so one bulk action can't time out the function. */
const BULK_MAX = 300;
/** Parallelism for the per-student update+queue fan-out. */
const BULK_CONCURRENCY = 10;

const slotModeSchema = z.enum(["NONE", "SAME", "SEQUENTIAL"]);

const bulkSchema = z.object({
  /** target status for every candidate */
  status: z.string().refine(isApplicationStatus, "Unknown status"),
  /** explicit candidates - wins over filters when present */
  ids: z.array(z.string().min(6).max(64)).max(500).optional(),
  /** filter mode: department lane */
  department: z.string().max(40).optional(),
  /** filter mode: only move files currently on this status */
  fromStatus: z.string().max(30).optional(),
  /** shared note stamped on every moved file (mailed like single commits) */
  note: z.string().max(1000).optional().nullable(),
  /** slot allotment strategy - only meaningful for slotted shortlists */
  slotMode: slotModeSchema.optional().default("NONE"),
  /** SAME: one shared slot for every candidate (ISO datetime) */
  interviewAt: z.string().max(40).optional().nullable(),
  /** SEQUENTIAL: first slot of the stagger (ISO datetime) */
  slotStartAt: z.string().max(40).optional().nullable(),
  /** SEQUENTIAL: gap between back-to-back slots (minutes) */
  slotIntervalMinutes: z.number().int().min(5).max(120).optional().default(15),
  /** GOOGLE_MEET | IN_PERSON | PHONE (defaults to GOOGLE_MEET for new slots) */
  interviewMode: z.string().max(20).optional().nullable(),
  /** single-panel assignment (SAME, or SEQUENTIAL fallback) */
  interviewPanel: z.string().max(40).optional().nullable(),
  /** SEQUENTIAL: rotate candidates across these panels (round-robin) */
  slotPanels: z.array(z.string().max(40)).max(10).optional(),
  /** skip the ±45min per-panel overlap guard (admin confirmed double-booking) */
  force: z.boolean().optional().default(false),
  /** skip files that already hold a slot instead of overwriting it */
  skipSlotted: z.boolean().optional().default(false),
});

function parseIsoOrNull(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(raw).toISOString();
}

/**
 * POST /api/admin/applications/bulk
 * Move many applications to one status in a single request (e.g. all
 * technical SUBMITTED files → SHORTLISTED_R1). Every moved file gets its
 * statusHistory entry; every mailable move queues its STATUS_CHANGE row
 * for the manual outbox flush.
 *
 * Slot allotment (slotted targets SHORTLISTED / SHORTLISTED_R2 only):
 * - slotMode SAME: every candidate gets the same interviewAt/mode/panel.
 * - slotMode SEQUENTIAL: candidates get staggered slots from slotStartAt,
 *   spaced slotIntervalMinutes apart, optionally round-robined across
 *   slotPanels so parallel panels run the same clock range.
 * Without a slot, slotted targets move the status but hold the mail (same
 * rule as the single-commit route - the mail goes out when the slot is
 * added per file). With a slot, the mail queues WITH the slot details.
 */
export async function POST(req: NextRequest) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }
  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  const target = parsed.data.status;
  if (target === "SUBMITTED") {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", message: "Bulk moves never target SUBMITTED." },
      { status: 400 }
    );
  }
  const department = parsed.data.department?.trim() || undefined;
  if (department && !getDepartment(department)) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }
  const fromStatus = parsed.data.fromStatus?.trim() || undefined;
  if (fromStatus && !isApplicationStatus(fromStatus)) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  const slottedTarget = isSlottedShortlistStatus(target);
  const slotMode = parsed.data.slotMode ?? "NONE";
  const wantsSlot = slotMode !== "NONE";

  // slots only exist on slotted shortlists - refuse them elsewhere so a
  // misclick can't silently drop slot data on e.g. INTERVIEWED.
  if (!slottedTarget && wantsSlot) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        message: "Slots only attach to SHORTLISTED / SHORTLISTED_R2.",
      },
      { status: 400 }
    );
  }

  const sharedNote =
    parsed.data.note?.trim() && parsed.data.note.trim().length > 0
      ? parsed.data.note.trim()
      : null;

  // --- validate the slot payload -------------------------------------
  let sameSlotAt: string | null = null;
  let seqStartAt: string | null = null;
  const interval = parsed.data.slotIntervalMinutes ?? 15;
  let interviewMode: string | null = null;
  let singlePanel: string | null = null;
  let seqPanels: string[] = [];

  if (wantsSlot) {
    if (
      parsed.data.interviewMode != null &&
      !(typeof parsed.data.interviewMode === "string" && isInterviewMode(parsed.data.interviewMode))
    ) {
      return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
    }
    interviewMode = parsed.data.interviewMode ?? "GOOGLE_MEET";

    const roster = await getInterviewPanels();
    if (parsed.data.interviewPanel != null) {
      const explicit = normalizePanelName(parsed.data.interviewPanel);
      if (!explicit || !roster.includes(explicit)) {
        return NextResponse.json({ error: "UNKNOWN_PANEL" }, { status: 400 });
      }
      singlePanel = explicit;
    }
    if (parsed.data.slotPanels?.length) {
      const clean = parsed.data.slotPanels
        .map((p) => normalizePanelName(p))
        .filter((p): p is string => p !== null);
      if (clean.length === 0) {
        return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
      }
      const unknown = clean.filter((p) => !roster.includes(p));
      if (unknown.length > 0) {
        return NextResponse.json({ error: "UNKNOWN_PANEL" }, { status: 400 });
      }
      seqPanels = [...new Set(clean)];
    }

    if (slotMode === "SAME") {
      sameSlotAt = parseIsoOrNull(parsed.data.interviewAt);
      if (!sameSlotAt) {
        return NextResponse.json(
          { error: "VALIDATION_FAILED", message: "SAME slot needs interviewAt." },
          { status: 400 }
        );
      }
    } else {
      seqStartAt = parseIsoOrNull(parsed.data.slotStartAt);
      if (!seqStartAt) {
        return NextResponse.json(
          {
            error: "VALIDATION_FAILED",
            message: "SEQUENTIAL slots need slotStartAt.",
          },
          { status: 400 }
        );
      }
    }
  }

  try {
    // resolve candidates: explicit ids win, otherwise the filter set
    let candidates: ApplicationRecord[];
    if (parsed.data.ids?.length) {
      const wanted = new Set(parsed.data.ids);
      const all = await listApplications({
        department,
        ...(fromStatus ? { status: fromStatus } : {}),
      });
      candidates = all.filter((a) => wanted.has(a.id));
    } else {
      candidates = await listApplications({
        department,
        ...(fromStatus ? { status: fromStatus } : {}),
      });
    }

    let skippedAlreadyThere = 0;
    let skippedOffLane = 0;
    let skippedSlotted = 0;
    const queue: ApplicationRecord[] = [];
    for (const app of candidates) {
      // R1/R2 are technical-only - skip (never move) anything else
      if (
        (target === "SHORTLISTED_R1" || target === "SHORTLISTED_R2") &&
        app.department !== "technical"
      ) {
        skippedOffLane += 1;
        continue;
      }
      // keep existing slots when asked: files that already hold one stay out
      if (wantsSlot && parsed.data.skipSlotted && app.interviewAt) {
        skippedSlotted += 1;
        continue;
      }
      // same-status files still count when a slot is being allotted
      // (slot-only top-up); otherwise they are already there.
      if (app.status === target && !wantsSlot) {
        skippedAlreadyThere += 1;
        continue;
      }
      queue.push(app);
    }

    const batch = queue.slice(0, BULK_MAX);
    const truncated = queue.length - batch.length;

    // deterministic stagger order: the listed order is the allotment order
    const startMs = seqStartAt ? Date.parse(seqStartAt) : 0;
    const fallbackPanels =
      seqPanels.length > 0
        ? seqPanels
        : singlePanel
          ? [singlePanel]
          : [DEFAULT_INTERVIEW_PANEL];

    let updated = 0;
    let emailed = 0;
    let held = 0;
    let failed = 0;
    let skippedConflict = 0;
    const conflicts: Array<{
      id: string;
      fullName: string;
      interviewAt: string;
      interviewPanel: string;
    }> = [];

    for (let i = 0; i < batch.length; i += BULK_CONCURRENCY) {
      const chunk = batch.slice(i, i + BULK_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (app, chunkIdx) => {
          const seqIndex = i + chunkIdx;
          // resolve this candidate's slot (null = status-only move, mail held)
          let interviewAt: string | null = null;
          let mode: string | null = null;
          let panel: string | null = null;
          if (slotMode === "SAME" && sameSlotAt) {
            interviewAt = sameSlotAt;
            mode = interviewMode;
            panel =
              singlePanel ??
              normalizePanelName(app.interviewPanel) ??
              DEFAULT_INTERVIEW_PANEL;
          } else if (slotMode === "SEQUENTIAL" && seqStartAt) {
            interviewAt = new Date(
              startMs + seqIndex * interval * 60_000
            ).toISOString();
            mode = interviewMode;
            panel =
              seqPanels.length > 0
                ? fallbackPanels[seqIndex % fallbackPanels.length]
                : (singlePanel ??
                  normalizePanelName(app.interviewPanel) ??
                  DEFAULT_INTERVIEW_PANEL);
          }

          // per-panel overlap guard (±45min) - skipped files are reported,
          // not failed, so the rest of the batch still commits. force
          // double-books like the single-commit route.
          if (interviewAt && !parsed.data.force) {
            const existing = await findInterviewConflicts({
              excludeId: app.id,
              aroundIso: interviewAt,
              windowMinutes: 45,
              panel: panel ?? DEFAULT_INTERVIEW_PANEL,
            });
            if (existing.length > 0) {
              return { conflicted: true as const, app, interviewAt, panel };
            }
          }

          const saved = await updateApplicationStatus({
            id: app.id,
            status: target,
            note: sharedNote,
            reviewedBy: adminEmail,
            interviewAt,
            interviewMode: mode,
            // status-only moves must NOT wipe a hand-set slot: leave the
            // panel untouched unless this request assigns one.
            ...(interviewAt ? { interviewPanel: panel } : {}),
          });
          if (!saved) throw new Error("NOT_FOUND");
          // same hold rule as single commits: slotted targets without a
          // slot move silently; everything else queues its mail. R1 (no
          // slot by design) always queues.
          if (slottedTarget && !interviewAt) return { mailed: false as const };
          const ok = await queueBulkMail(saved, target, {
            interviewAt,
            interviewMode: mode,
            interviewPanel: panel,
          });
          return { mailed: ok as boolean };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          if ("conflicted" in r.value && r.value.conflicted) {
            skippedConflict += 1;
            if (conflicts.length < 10) {
              conflicts.push({
                id: r.value.app.id,
                fullName: r.value.app.fullName,
                interviewAt: r.value.interviewAt as string,
                interviewPanel: resolveSlotPanel(
                  r.value.panel as string | null
                ),
              });
            }
            continue;
          }
          updated += 1;
          if ("mailed" in r.value && r.value.mailed) emailed += 1;
          else held += 1;
        } else {
          failed += 1;
          console.error("[api/admin/applications/bulk] item failed:", r.reason);
        }
      }
    }

    return NextResponse.json({
      total: candidates.length,
      updated,
      emailed,
      held,
      skippedAlreadyThere,
      skippedOffLane,
      skippedSlotted,
      skippedConflict,
      conflicts,
      truncated,
      failed,
      slotMode,
    });
  } catch (err) {
    console.error("[api/admin/applications/bulk] POST failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * Outbox mail for one bulk-moved file. Mirrors the single-commit body
 * (shared note + slot + panel when present; bulk never attaches per-file
 * notes). Never throws - a mail failure only skips that row's queue entry.
 */
async function queueBulkMail(
  app: ApplicationRecord,
  target: string,
  slot?: {
    interviewAt: string | null;
    interviewMode: string | null;
    interviewPanel: string | null;
  }
): Promise<boolean> {
  try {
    const meta = getStatusMeta(target);
    const parts = [
      `Hi ${app.fullName},`,
      "",
      `Your NEXUS Recruitments '26 application (d ${app.department}/) moved to ${meta.label}.`,
      "",
      meta.studentCopy,
    ];
    if (app.statusNote) parts.push("", `Note from the core team: ${app.statusNote}`);
    if (slot?.interviewAt) {
      parts.push(
        "",
        `Interview slot: ${new Date(slot.interviewAt).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        })} IST${slot.interviewMode ? ` · ${slot.interviewMode}` : ""}`
      );
      if (slot.interviewPanel && slot.interviewPanel !== DEFAULT_INTERVIEW_PANEL) {
        parts.push(
          "",
          `Interview panel: ${slot.interviewPanel} - report there for your slot.`
        );
      }
    }
    if (target === "SHORTLISTED_R1") {
      const siteUrl = (
        process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.runs-on.dev"
      ).replace(/\/$/, "");
      const deadline = await getTechRound1Deadline();
      parts.push(
        "",
        "ROUND 1 - build round (no interview slot):",
        `  1. Read the project brief: ${siteUrl}${TECH_ROUND1_BRIEF_URL}`,
        `  2. Open your application page (${siteUrl}/apply), pick your problem statement (01-04), and submit your GitHub repo + report${deadline ? ` before ${new Date(deadline).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit", hour12: false })} IST` : " (deadline to be announced - watch the WhatsApp group)"} (deploy link optional).`,
        "  3. You can re-submit until the deadline - the last version counts."
      );
    }
    if (
      target === "SHORTLISTED" ||
      target === "SHORTLISTED_R1" ||
      target === "SHORTLISTED_R2"
    ) {
      const groupLink = getDomainWhatsappGroupLink(app.department);
      if (groupLink) {
        parts.push(
          "",
          `You are also invited to join the ${getDepartmentName(app.department)} WhatsApp group: ${groupLink}`
        );
      }
    }
    if (target === "ACCEPTED") {
      // community invite is required - without the env var this file's
      // mail is skipped (counted as held) instead of failing the batch
      let communityLink: string;
      try {
        communityLink = getNexusCommunityLink();
      } catch {
        console.error(
          `[api/admin/applications/bulk] ${NEXUS_COMMUNITY_ENV_KEY} unset - mail skipped for ${app.email}`
        );
        return false;
      }
      parts.push(
        "",
        `Join the Nexus WhatsApp Community for onboarding and your first build night: ${communityLink}`,
        "",
        `P.S. Your acceptance certificate (${CERTIFICATE_BUCKET}/${certificatePathForWhatsapp(app.whatsapp)}) rides along with this email - it is attached when core flushes the outbox.`
      );
    }
    parts.push("", "- NEXUS core team · VIT Chennai", "https://nexus.runs-on.dev");
    await queueNotification({
      applicationId: app.id,
      email: app.email,
      fullName: app.fullName,
      type: "STATUS_CHANGE",
      subject: `[NEXUS '26] Application update - ${meta.label}`,
      body: parts.join("\n"),
    });
    return true;
  } catch (err) {
    console.error("[api/admin/applications/bulk] queue failed:", err);
    return false;
  }
}
