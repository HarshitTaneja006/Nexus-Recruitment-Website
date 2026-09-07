import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { getMailProvider } from "@/lib/mailer";
import {
  listNotifications,
  markAllNotificationsSent,
  markNotificationSent,
  requeueNotification,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const actionSchema = z.object({
  /** claim a single queued row */
  id: z.string().min(6).max(64).optional(),
  /** claim everything queued (worker drain simulation) */
  all: z.boolean().optional(),
  /** send = mark SENT · requeue = put a FAILED row back in the queue */
  action: z.enum(["send", "requeue"]).default("send"),
});

/**
 * GET /api/admin/notifications?status=&type=&q= - outbox rows (newest
 * first) + global queued counter + delivery provider hint
 * ("smtp" | "sandbox"). Only submission receipts auto-send; everything
 * else waits here for a manual flush (all or selected).
 * PATCH /api/admin/notifications - {id, action:"send"} mark SENT ·
 * {id, action:"requeue"} put a FAILED row back in the queue ·
 * {all:true} drain-simulate everything queued.
 *
 * The real drain lives at POST /api/admin/notifications/drain (claims FIFO
 * or an explicit id list, delivers via nodemailer/SMTP when SMTP_HOST is
 * set, marks FAILED + reason on error). The console below mirrors exactly
 * that state machine.
 */
export async function GET(req: NextRequest) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const params = req.nextUrl.searchParams;
  try {
    const outbox = await listNotifications({
      status: params.get("status") ?? undefined,
      type: params.get("type") ?? undefined,
      q: params.get("q")?.trim() || undefined,
    });
    // capability hint for the console - never leaks the key itself
    const provider = getMailProvider();
    return NextResponse.json({ ...outbox, provider });
  } catch (err) {
    console.error("[api/admin/notifications] GET failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
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

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success || (!parsed.data.id && !parsed.data.all)) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  try {
    if (parsed.data.all) {
      const count = await markAllNotificationsSent();
      return NextResponse.json({ flushed: count });
    }
    if (parsed.data.action === "requeue") {
      const ok = await requeueNotification(parsed.data.id!);
      if (!ok) return NextResponse.json({ error: "NOT_FAILED" }, { status: 409 });
      return NextResponse.json({ requeued: true });
    }
    const ok = await markNotificationSent(parsed.data.id!);
    if (!ok) return NextResponse.json({ error: "NOT_QUEUED" }, { status: 409 });
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[api/admin/notifications] PATCH failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
