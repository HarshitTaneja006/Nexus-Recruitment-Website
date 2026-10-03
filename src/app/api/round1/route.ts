import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isValidVitEmail } from "@/lib/vit";
import {
  findApplicationByEmail,
  getTechRound1Deadline,
  submitTechRound1,
} from "@/lib/storage";
import {
  TECH_ROUND1_BRIEF_URL,
  isTechRound1Candidate,
  techRound1Schema,
} from "@/lib/tech-round1";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/round1 - tech Round 1 screen data for the signed-in student.
 * 200 with { application, deadline, briefUrl } for SHORTLISTED_R1
 * technical students; 404 otherwise (not eligible yet).
 */
export async function GET() {
  const session = await getAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isValidVitEmail(session.user.email)) {
    return NextResponse.json({ error: "NOT_VIT_EMAIL" }, { status: 403 });
  }
  const email = session.user.email.trim().toLowerCase();
  const application = await findApplicationByEmail(email);
  if (!application || !isTechRound1Candidate(application.department, application.status)) {
    return NextResponse.json({ error: "NOT_ELIGIBLE" }, { status: 404 });
  }
  const { panelNote: _omitted, ...studentView } = application;
  const deadline = await getTechRound1Deadline();
  return NextResponse.json({
    application: studentView,
    deadline,
    briefUrl: TECH_ROUND1_BRIEF_URL,
  });
}

/**
 * POST /api/round1 - Round 1 project hand-in.
 * Body: { githubUrl, reportUrl, deployUrl? }. Re-submits overwrite
 * until the deadline. Only technical SHORTLISTED_R1 students.
 */
export async function POST(req: NextRequest) {
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
  const parsed = techRound1Schema.safeParse(body);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path.join(".") || "_";
      if (!fields[key]) fields[key] = issue.message;
    }
    return NextResponse.json({ error: "VALIDATION_FAILED", fields }, { status: 400 });
  }

  const email = session.user.email.trim().toLowerCase();
  const application = await findApplicationByEmail(email);
  if (!application || !isTechRound1Candidate(application.department, application.status)) {
    return NextResponse.json({ error: "NOT_ELIGIBLE" }, { status: 403 });
  }

  const deadline = await getTechRound1Deadline();
  if (deadline && Date.now() > new Date(deadline).getTime()) {
    return NextResponse.json({ error: "ROUND1_CLOSED" }, { status: 423 });
  }

  try {
    const updated = await submitTechRound1({
      id: application.id,
      githubUrl: parsed.data.githubUrl,
      reportUrl: parsed.data.reportUrl,
      deployUrl: parsed.data.deployUrl?.trim() ? parsed.data.deployUrl.trim() : null,
    });
    if (!updated) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }
    const { panelNote: _omitted, ...studentView } = updated;
    return NextResponse.json({ application: studentView, deadline });
  } catch (err) {
    console.error("[api/round1] submit failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
