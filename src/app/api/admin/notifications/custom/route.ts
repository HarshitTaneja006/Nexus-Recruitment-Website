import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import {
  listApplications,
  queueNotification,
} from "@/lib/storage";
import { getDepartmentName } from "@/lib/departments";
import { getStatusLabel } from "@/lib/status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** application ids the mail should go to (deduped, max 200 per batch) */
  ids: z.array(z.string().min(6).max(64)).min(1).max(200),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(4000),
});

/**
 * POST /api/admin/notifications/custom — compose + queue a custom email to
 * the selected applicants from the review console. Template variables are
 * merged per student: {{name}} {{domain}} {{status}} {{year}}.
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
    const all = await listApplications({});
    const byId = new Map(all.map((a) => [a.id, a]));

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
          .replaceAll("{{whatsapp}}", app.whatsapp || "—");

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
          "— NEXUS core team · VIT Chennai",
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
