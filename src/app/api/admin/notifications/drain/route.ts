import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import {
  listNotifications,
  listQueuedNotifications,
  markNotificationSent,
  markNotificationFailed,
} from "@/lib/storage";
import { queueDraftReminderSweep } from "@/lib/notify";
import { getMailProvider, sendMail } from "@/lib/mailer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** max rows to claim per drain (FIFO) - keeps a single request bounded */
  limit: z.number().int().min(1).max(100).optional(),
  /** skip the automatic deadline-near draft reminder sweep */
  skipSweep: z.boolean().optional(),
});

/**
 * POST /api/admin/notifications/drain - the outbox worker.
 *
 * Before claiming, it runs the deadline-near DRAFT reminder sweep (once
 * per 48h per student, automatically whenever the drain executes inside
 * the reminder window) unless skipSweep is set.
 *
 * Claims QUEUED rows FIFO and delivers each via the configured provider:
 *  - SMTP_HOST set (smtp)    → nodemailer delivery through the configured
 *                              relay (branded HTML + plain-text fallback)
 *  - SMTP_HOST unset (sandbox) → rows are marked SENT immediately; the
 *                              delivery is simulated so the console state
 *                              machine stays testable
 * Failures mark the row FAILED with the provider reason; the core team can
 * RETRY (re-queue) from the outbox panel and drain again.
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

  const provider = getMailProvider();

  try {
    // Deadline-near reminder sweep - idempotent (48h dedupe per student).
    let draftReminders = 0;
    if (!parsed.data.skipSweep) {
      try {
        draftReminders = await queueDraftReminderSweep();
      } catch (sweepErr) {
        console.error("[drain] draft reminder sweep failed:", sweepErr);
      }
    }

    const claimed = await listQueuedNotifications(parsed.data.limit ?? 25);
    let delivered = 0;
    const failed: Array<{ id: string; email: string; reason: string }> = [];

    for (const row of claimed) {
      if (provider === "sandbox") {
        // sandbox provider: nothing to call - accept the hand-off
        await markNotificationSent(row.id);
        delivered += 1;
        continue;
      }
      try {
        await sendMail({
          to: row.email,
          subject: row.subject,
          text: row.body,
        });
        await markNotificationSent(row.id);
        delivered += 1;
      } catch (err) {
        const reason = `smtp: ${err instanceof Error ? err.message : "delivery error"}`.slice(
          0,
          240
        );
        await markNotificationFailed(row.id, reason);
        failed.push({ id: row.id, email: row.email, reason });
      }
    }

    const { queued } = await listNotifications(1);
    return NextResponse.json({
      provider,
      claimed: claimed.length,
      delivered,
      failed,
      draftReminders,
      queuedRemaining: queued,
      drainedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[api/admin/notifications/drain] POST failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
