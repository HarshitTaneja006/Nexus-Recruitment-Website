import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  getTechRound1Deadline,
  setTechRound1Deadline,
} from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/tech-round1-deadline - current global Round 1 deadline.
 * { deadline: ISO | null }. Admin-only.
 */
export async function GET() {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const deadline = await getTechRound1Deadline();
  return NextResponse.json({ deadline });
}

/**
 * PUT /api/admin/tech-round1-deadline - set / clear the deadline.
 * Body: { deadline: ISO datetime string | null }. Null clears it
 * (submissions stay open until core sets one).
 */
export async function PUT(req: NextRequest) {
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
  const raw =
    body && typeof body === "object" && "deadline" in body
      ? (body as { deadline: unknown }).deadline
      : undefined;
  try {
    if (raw === null || raw === undefined || raw === "") {
      const deadline = await setTechRound1Deadline(null);
      return NextResponse.json({ deadline });
    }
    if (typeof raw !== "string" || Number.isNaN(Date.parse(raw))) {
      return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
    }
    const deadline = await setTechRound1Deadline(new Date(raw).toISOString());
    return NextResponse.json({ deadline });
  } catch {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }
}
