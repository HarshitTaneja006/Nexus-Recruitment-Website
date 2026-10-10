import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/admin";
import { getMailProvider } from "@/lib/mailer";
import {
  CERTIFICATE_BUCKET,
  certificateExistsForWhatsapp,
  certificatePathForWhatsapp,
  isAcceptanceNotification,
} from "@/lib/certificates";
import {
  findApplicationByEmail,
  getApplicationById,
  listNotifications,
  listQueuedNotifications,
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
 * GET /api/admin/notifications?status=&type=&q=&page= - outbox rows newest
 * first, 50 per page (page/pageCount/total included) + global queued
 * counter + delivery provider hint ("smtp" | "sandbox"). Only submission receipts auto-send; everything
 * else waits here for a manual flush (all or selected).
 * PATCH /api/admin/notifications - {id, action:"send"} mark SENT ·
 * {id, action:"requeue"} put a FAILED row back in the queue ·
 * {all:true} drain-simulate everything queued.
 *
 * NOTE: the PATCH "send" paths are direct claims (no SMTP delivery, no
 * attachment). Acceptance rows may NOT be claimed here - they must go
 * through POST /drain so the certificate gate + PNG attachment apply.
 * A PATCH send on an acceptance row returns 409 CERT_REQUIRED.
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
  const pageParam = Number(params.get("page") ?? "1");
  const page =
    Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;
  const PAGE_SIZE = 50;
  try {
    const outbox = await listNotifications({
      take: PAGE_SIZE,
      page,
      status: params.get("status") ?? undefined,
      type: params.get("type") ?? undefined,
      q: params.get("q")?.trim() || undefined,
    });
    // capability hint for the console - never leaks the key itself
    const provider = getMailProvider();
    return NextResponse.json({
      ...outbox,
      provider,
      page,
      pageSize: PAGE_SIZE,
      pageCount: Math.max(1, Math.ceil(outbox.total / PAGE_SIZE)),
    });
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
      // Bulk-claim bypasses the drain, so it must not silently flush
      // acceptance mails past the certificate gate. Refuse while any
      // QUEUED acceptance row lacks its PNG (<whatsapp>.png).
      const queued = await listQueuedNotifications(100);
      const missing: string[] = [];
      for (const row of queued) {
        if (!isAcceptanceNotification(row)) continue;
        try {
          const whatsapp = await resolveWhatsappForRow(row.applicationId, row.email);
          if (!whatsapp) {
            missing.push(`${CERTIFICATE_BUCKET}/<whatsapp>.png (no number on file for ${row.email})`);
            continue;
          }
          const { exists } = await certificateExistsForWhatsapp(whatsapp);
          if (!exists) missing.push(`${CERTIFICATE_BUCKET}/${certificatePathForWhatsapp(whatsapp)}`);
        } catch {
          missing.push(`${CERTIFICATE_BUCKET}/<whatsapp>.png (${row.email})`);
        }
      }
      if (missing.length > 0) {
        return NextResponse.json(
          {
            error: "CERT_REQUIRED",
            message: `Refusing bulk-claim: ${missing.length} acceptance mail(s) lack certificates. Flush via FLUSH_QUEUE/FLUSH_SELECTED after uploading: ${missing[0]}${missing.length > 1 ? "…" : ""}`,
            missing: missing.slice(0, 10),
          },
          { status: 409 }
        );
      }
      const count = await markAllNotificationsSent();
      return NextResponse.json({ flushed: count });
    }
    if (parsed.data.action === "requeue") {
      const ok = await requeueNotification(parsed.data.id!);
      if (!ok) return NextResponse.json({ error: "NOT_FAILED" }, { status: 409 });
      return NextResponse.json({ requeued: true });
    }
    // Single-row claim: acceptance rows must go through the drain (cert
    // gate + attachment). Look the row up among QUEUED to decide.
    const queued = await listQueuedNotifications(100);
    const target = queued.find((n) => n.id === parsed.data.id);
    if (target && isAcceptanceNotification(target)) {
      const whatsapp = await resolveWhatsappForRow(target.applicationId, target.email);
      const need = whatsapp
        ? `${CERTIFICATE_BUCKET}/${certificatePathForWhatsapp(whatsapp)}`
        : `${CERTIFICATE_BUCKET}/<whatsapp>.png`;
      return NextResponse.json(
        {
          error: "CERT_REQUIRED",
          message: `Acceptance mail for ${target.email} needs ${need} - flush it from the outbox (FLUSH_SELECTED) instead of claiming here.`,
        },
        { status: 409 }
      );
    }
    const ok = await markNotificationSent(parsed.data.id!);
    if (!ok) return NextResponse.json({ error: "NOT_QUEUED" }, { status: 409 });
    return NextResponse.json({ sent: true });
  } catch (err) {
    console.error("[api/admin/notifications] PATCH failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

/**
 * Resolve the 10-digit WhatsApp number backing an outbox row, via the
 * application id with an email fallback. Null when the application is
 * gone or carries no usable number.
 */
async function resolveWhatsappForRow(
  applicationId: string,
  email: string
): Promise<string | null> {
  try {
    if (applicationId && !applicationId.startsWith("draft:")) {
      const byId = await getApplicationById(applicationId);
      const w = byId?.whatsapp?.trim();
      if (w && /^[0-9]{10}$/.test(w.replace(/[^0-9]/g, ""))) return w;
    }
  } catch {
    // fall through to the email lookup
  }
  try {
    const byEmail = await findApplicationByEmail(email);
    const w = byEmail?.whatsapp?.trim();
    if (w && /^[0-9]{10}$/.test(w.replace(/[^0-9]/g, ""))) return w;
  } catch {
    return null;
  }
  return null;
}
