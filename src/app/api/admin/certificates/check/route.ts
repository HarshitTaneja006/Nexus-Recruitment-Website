import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  CERTIFICATE_BUCKET,
  certificateExistsForWhatsapp,
  certificatePathForWhatsapp,
} from "@/lib/certificates";
import { findApplicationByEmail } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/certificates/check?email=… (or ?whatsapp=…) - does this
 * student's PNG exist in the certificates bucket yet?
 *
 * Certificates are keyed <whatsapp>.png. With ?email= the whatsapp
 * number is resolved from the application first.
 *
 * Response: { email, whatsapp, bucket, path, exists }
 * A missing PNG is exists:false (the drain is what blocks the flush).
 * Errors are storage outages / unknown student.
 */
export async function GET(req: NextRequest) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const whatsappParam =
    req.nextUrl.searchParams.get("whatsapp")?.replace(/[^0-9]/g, "") ?? "";
  const email = req.nextUrl.searchParams.get("email")?.trim().toLowerCase() ?? "";

  let whatsapp = whatsappParam.length >= 10 ? whatsappParam : null;
  if (!whatsapp) {
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
    }
    try {
      const app = await findApplicationByEmail(email);
      whatsapp = app?.whatsapp?.replace(/[^0-9]/g, "") || null;
    } catch (err) {
      console.error("[api/admin/certificates/check] lookup failed:", err);
      return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
    }
    if (!whatsapp) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
  }
  try {
    const { path, exists } = await certificateExistsForWhatsapp(whatsapp);
    return NextResponse.json({
      email: email || null,
      whatsapp,
      bucket: CERTIFICATE_BUCKET,
      path,
      exists,
    });
  } catch (err) {
    console.error("[api/admin/certificates/check] GET failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}

/** Convenience export for the outbox copy (single source of the naming rule). */
export { certificatePathForWhatsapp };
