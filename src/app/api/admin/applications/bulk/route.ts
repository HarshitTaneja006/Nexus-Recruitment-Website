import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { isApplicationStatus, getStatusMeta, isSlottedShortlistStatus } from "@/lib/status";
import { getDepartment, getDepartmentName, getDomainWhatsappGroupLink } from "@/lib/departments";
import { NEXUS_COMMUNITY_ENV_KEY, getNexusCommunityLink } from "@/lib/community";
import { certificatePathForEmail, CERTIFICATE_BUCKET } from "@/lib/certificates";
import {
  listApplications,
  queueNotification,
  updateApplicationStatus,
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

const bulkSchema = z.object({
  /** target status for every candidate */
  status: z.string().refine(isApplicationStatus, "Unknown status"),
  /** explicit candidates - wins over filters when present */
  ids: z.array(z.string().min(6).max(64)).max(500).optional(),
  /** filter mode: department lane */
  department: z.string().max(40).optional(),
  /** filter mode: only move files currently on this status */
  fromStatus: z.string().max(30).optional(),
});

/**
 * POST /api/admin/applications/bulk
 * Move many applications to one status in a single request (e.g. all
 * technical SUBMITTED files → SHORTLISTED_R1). Every moved file gets its
 * statusHistory entry; every mailable move queues its STATUS_CHANGE row
 * for the manual outbox flush. Slotted targets without a slot move the
 * status but hold the mail (same rule as the single-commit route - the
 * mail goes out when the slot is added per file).
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
    const queue: ApplicationRecord[] = [];
    for (const app of candidates) {
      if (app.status === target) {
        skippedAlreadyThere += 1;
        continue;
      }
      // R1/R2 are technical-only - skip (never move) anything else
      if (
        (target === "SHORTLISTED_R1" || target === "SHORTLISTED_R2") &&
        app.department !== "technical"
      ) {
        skippedOffLane += 1;
        continue;
      }
      queue.push(app);
    }

    const batch = queue.slice(0, BULK_MAX);
    const truncated = queue.length - batch.length;

    let updated = 0;
    let emailed = 0;
    let held = 0;
    let failed = 0;

    for (let i = 0; i < batch.length; i += BULK_CONCURRENCY) {
      const chunk = batch.slice(i, i + BULK_CONCURRENCY);
      const results = await Promise.allSettled(
        chunk.map(async (app) => {
          const saved = await updateApplicationStatus({
            id: app.id,
            status: target,
            note: null,
            reviewedBy: adminEmail,
            interviewAt: null,
            interviewMode: null,
          });
          if (!saved) throw new Error("NOT_FOUND");
          // same hold rule as single commits: slotted targets without a
          // slot move silently; everything else queues its mail. R1 (no
          // slot by design) always queues.
          const slottedTarget = isSlottedShortlistStatus(target);
          if (slottedTarget) return { mailed: false as const };
          const ok = await queueBulkMail(saved, target);
          return { mailed: ok as boolean };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") {
          updated += 1;
          if (r.value.mailed) emailed += 1;
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
      truncated,
      failed,
    });
  } catch (err) {
    console.error("[api/admin/applications/bulk] POST failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * Outbox mail for one bulk-moved file. Mirrors the single-commit body
 * for the no-slot case (bulk never attaches slots or per-file notes).
 * Never throws - a mail failure only skips that row's queue entry.
 */
async function queueBulkMail(app: ApplicationRecord, target: string): Promise<boolean> {
  try {
    const meta = getStatusMeta(target);
    const parts = [
      `Hi ${app.fullName},`,
      "",
      `Your NEXUS Recruitments '26 application (d ${app.department}/) moved to ${meta.label}.`,
      "",
      meta.studentCopy,
    ];
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
        `P.S. Your acceptance certificate (${CERTIFICATE_BUCKET}/${certificatePathForEmail(app.email)}) rides along with this email - it is attached when core flushes the outbox.`
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
