import { NextRequest, NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isValidVitEmail, parseVitEmail } from "@/lib/vit";
import { isDriveOpen } from "@/lib/drive";
import {
  findApplicationByEmail,
  submitApplication,
  resolveUserId,
  queueNotification,
} from "@/lib/storage";
import {
  submitApplicationSchema,
  buildAnswersSchema,
  zodErrorsToFieldMap,
} from "@/lib/validation";
import { getDepartment } from "@/lib/departments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/application — the signed-in student's submitted application. */
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
  return NextResponse.json({ application });
}

/** POST /api/application — submit (or re-submit before deadline) the form. */
export async function POST(req: NextRequest) {
  const session = await getAuthSession();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "UNAUTHENTICATED" }, { status: 401 });
  }
  if (!isValidVitEmail(session.user.email)) {
    return NextResponse.json(
      { error: "NOT_VIT_EMAIL", message: "Only VIT student emails can apply." },
      { status: 403 }
    );
  }
  if (!isDriveOpen()) {
    return NextResponse.json(
      { error: "DRIVE_CLOSED", message: "The recruitment drive is closed." },
      { status: 423 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "BAD_JSON" }, { status: 400 });
  }

  const parsed = submitApplicationSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        fields: zodErrorsToFieldMap(parsed.error),
      },
      { status: 400 }
    );
  }

  const { department, answers } = parsed.data;
  const whatsapp = parsed.data.whatsapp.replace(/[ \-]/g, "");

  // Validate answers against this department's required questions
  const answersCheck = buildAnswersSchema(department).safeParse(answers);
  if (!answersCheck.success) {
    return NextResponse.json(
      {
        error: "VALIDATION_FAILED",
        fields: zodErrorsToFieldMap(answersCheck.error),
      },
      { status: 400 }
    );
  }

  const profile = parseVitEmail(session.user.email);
  if (!profile) {
    return NextResponse.json({ error: "NOT_VIT_EMAIL" }, { status: 403 });
  }

  try {
    const userId = await resolveUserId(profile.email, profile.fullName);
    const application = await submitApplication({
      userId,
      email: profile.email,
      fullName: profile.fullName, // derived from email
      joinYear: profile.joinYear,
      yearOfStudy: profile.yearOfStudy, // derived from email
      input: { ...parsed.data, whatsapp },
    });

    // Queue the submission receipt (outbox worker delivers it — SMTP when
    // SMTP_HOST is set). Best-effort: never blocks the 201.
    try {
      const dept = getDepartment(department);
      const lines = [
        `Hi ${application.fullName},`,
        "",
        `Your NEXUS Recruitments '26 application is in — domain d ${dept?.dir ?? department}/ (${dept?.name ?? department}).`,
        "",
        `  APP_ID     ${application.id}`,
        `  SUBMITTED  ${new Date(application.submittedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false })} IST`,
        `  WHATSAPP   ${whatsapp}`,
        "",
        "What happens next:",
        "  1. Domain leads review every submission against depth and honesty.",
        "  2. Your live status appears on the application page (/apply) the moment it changes — SUBMITTED → SHORTLISTED → decision.",
        "  3. Any note from the core team lands in your inbox AND on your status page.",
        "",
        "You can edit and re-submit any time before the deadline — the new version overwrites this one.",
        "",
        "— NEXUS core team · VIT Chennai",
        "https://nexus.runs-on.dev",
      ];
      await queueNotification({
        applicationId: application.id,
        email: application.email,
        fullName: application.fullName,
        type: "SUBMISSION_RECEIPT",
        subject: `[NEXUS '26] Application received — d ${dept?.dir ?? department}/`,
        body: lines.join("\n"),
      });
    } catch (notifyErr) {
      console.error("[api/application] receipt queue failed:", notifyErr);
    }

    return NextResponse.json({ application }, { status: 201 });
  } catch (err) {
    console.error("[api/application] submit failed:", err);
    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Could not save your application. Your answers are safe — try again." },
      { status: 500 }
    );
  }
}
