import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import {
  listApplications,
  queueNotification,
  getTechRound1Deadline,
} from "@/lib/storage";
import { getDepartmentName } from "@/lib/departments";
import { getStatusLabel } from "@/lib/status";
import { TECH_ROUND1_BRIEF_URL } from "@/lib/tech-round1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** application ids the mail should go to (deduped, max 200 per batch) */
  ids: z.array(z.string().min(6).max(64)).min(1).max(200),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(4000),
});

/**
 * POST /api/admin/notifications/custom - compose + queue a custom email to
 * the selected applicants from the review console. Template variables are
 * merged per student: {{name}} {{domain}} {{status}} {{year}} {{whatsapp}}
 * plus the global Round 1 helpers {{round1deadline}} {{round1brief}} (for
 * the manually-sent SHORTLISTED_R1 brief mail - R1 commits queue nothing).
 * Rows land in the outbox as type=CUSTOM; FLUSH_QUEUE delivers via SMTP.
 */
export async function POST(req: Request) {
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "VALIDATION_FAILED", message: "Subject (3–160 chars), message (3–4000 chars) and at least one recipient are required." },
      { status: 400 }
    );
  }

  const { ids, subject, message } = parsed.data;

  try {
    const [all, round1Deadline] = await Promise.all([
      listApplications({}),
      getTechRound1Deadline(),
    ]);
    const byId = new Map(all.map((a) => [a.id, a]));
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.runs-on.dev").replace(/\/$/, "");
    const round1Brief = `${siteUrl}${TECH_ROUND1_BRIEF_URL}`;
    const round1DeadlineLabel = round1Deadline
      ? new Date(round1Deadline).toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          weekday: "long",
          day: "2-digit",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }) + " IST"
      : "to be announced - watch the WhatsApp group";

    let queued = 0;
    const missing: string[] = [];
    const seen = new Set<string>();

    for (const id of ids) {
      const app = byId.get(id);
      if (!app) {
        missing.push(id);
        continue;
      }
      if (seen.has(app.email)) continue; // one mail per student
      seen.add(app.email);

      const merge = (tpl: string) =>
        tpl
          .replaceAll("{{name}}", app.fullName)
          .replaceAll("{{domain}}", getDepartmentName(app.department))
          .replaceAll("{{status}}", getStatusLabel(app.status))
          .replaceAll("{{year}}", String(app.yearOfStudy))
          .replaceAll("{{whatsapp}}", app.whatsapp || "-")
          .replaceAll("{{round1deadline}}", round1DeadlineLabel)
          .replaceAll("{{round1brief}}", round1Brief);

      await queueNotification({
        applicationId: app.id,
        email: app.email,
        fullName: app.fullName,
        type: "CUSTOM",
        subject: merge(subject),
        body: [
          `Hi ${app.fullName},`,
          "",
          merge(message),
          "",
          "- NEXUS core team · VIT Chennai",
          "https://nexus.runs-on.dev",
        ].join("\n"),
      });
      queued += 1;
    }

    return NextResponse.json({ queued, missing, sentBy: adminEmail });
  } catch (err) {
    console.error("[api/admin/notifications/custom] POST failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
