import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  CERTIFICATE_BUCKET,
  certificateExistsForEmail,
  certificatePathForEmail,
} from "@/lib/certificates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/certificates/check?email=… - does this student's PNG
 * exist in the certificates bucket yet?
 *
 * Response: { email, bucket, path, exists }
 * 404 CERT_MISSING is NOT used here - a missing PNG is exists:false
 * (the drain is what blocks the flush). Errors are storage outages.
 */
export async function GET(req: NextRequest) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const email = req.nextUrl.searchParams.get("email")?.trim() ?? "";
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }
  try {
    const { path, exists } = await certificateExistsForEmail(email);
    return NextResponse.json({
      email: email.toLowerCase(),
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
export { certificatePathForEmail };
