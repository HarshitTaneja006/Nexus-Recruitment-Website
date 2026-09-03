import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isValidVitEmail } from "@/lib/vit";
import { deleteDraft, findDraft, upsertDraft, lookupUserId, resolveUserId } from "@/lib/storage";
import { draftSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Server-side mirror of the in-progress form. The browser keeps the
 * primary copy in localStorage; this protects students across devices
 * and browsers. Runs silently — failures never block the student.
 */

export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.email || !isValidVitEmail(session.user.email)) {
    return NextResponse.json({ draft: null });
  }
  const email = session.user.email.trim().toLowerCase();
  try {
    const userId = await lookupUserId(email);
    if (!userId) return NextResponse.json({ draft: null });
    const draft = await findDraft(userId);
    return NextResponse.json({ draft });
  } catch (err) {
    console.error("[api/application/draft] read failed:", err);
    return NextResponse.json({ draft: null });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isValidVitEmail(session.user.email)) {
    return NextResponse.json({ error: "NOT_VIT_EMAIL" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const parsed = draftSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  try {
    const email = session.user.email.trim().toLowerCase();
    const userId = await resolveUserId(email);
    const draft = await upsertDraft({
      userId,
      email,
      data: parsed.data,
    });
    return NextResponse.json({ ok: true, updatedAt: draft.updatedAt });
  } catch (err) {
    console.error("[api/application/draft] write failed:", err);
    // Never block the student on draft-sync failure — localStorage still holds the data.
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}

export async function DELETE() {
  const session = await getAuthSession();
  if (!session?.user?.email || !isValidVitEmail(session.user.email)) {
    return NextResponse.json({ ok: true });
  }
  try {
    const email = session.user.email.trim().toLowerCase();
    const userId = await lookupUserId(email);
    if (userId) await deleteDraft(userId);
  } catch (err) {
    console.error("[api/application/draft] delete failed:", err);
  }
  return NextResponse.json({ ok: true });
}
