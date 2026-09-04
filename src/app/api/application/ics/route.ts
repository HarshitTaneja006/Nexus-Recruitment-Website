import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { isValidVitEmail } from "@/lib/vit";
import { findApplicationByEmail } from "@/lib/storage";
import { getDepartment } from "@/lib/departments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/application/ics - student-gated calendar export for their
 * scheduled interview. Returns an RFC 5545 .ics file (with a 30-minute
 * reminder alarm) so students can drop the slot into any calendar app.
 * 404 when there is no live interview slot on the file (slot attaches to SHORTLISTED).
 */

const INTERVIEW_DURATION_MIN = 30;

/** RFC 5545 requires CRLF and escaped text specials. */
function icsEscape(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** UTC "YYYYMMDDTHHMMSSZ" stamp from an ISO instant. */
function icsStamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function modeLocation(mode: string | null): string {
  switch (mode) {
    case "IN_PERSON":
      return "VIT Chennai campus - venue in your core message";
    case "PHONE":
      return "Phone call - keep your phone reachable";
    case "GOOGLE_MEET":
      return "Google Meet - link in your core message";
    default:
      return "Details in your NEXUS core message";
  }
}

export async function GET() {
  const session = await getAuthSession();
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email || !isValidVitEmail(email)) {
    return NextResponse.json({ error: "NOT_VIT_EMAIL" }, { status: 403 });
  }

  try {
    const app = await findApplicationByEmail(email);
    if (!app || app.status !== "SHORTLISTED" || !app.interviewAt) {
      return NextResponse.json({ error: "NO_SCHEDULED_INTERVIEW" }, { status: 404 });
    }
    const start = new Date(app.interviewAt);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "NO_SCHEDULED_INTERVIEW" }, { status: 404 });
    }
    const end = new Date(start.getTime() + INTERVIEW_DURATION_MIN * 60_000);
    const dept = getDepartment(app.department);
    const modeLine =
      app.interviewMode === "IN_PERSON"
        ? "Mode: in person (on campus)"
        : app.interviewMode === "PHONE"
          ? "Mode: phone call"
          : app.interviewMode === "GOOGLE_MEET"
            ? "Mode: Google Meet"
            : "Mode: announced by the core team";

    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://nexus.runs-on.dev";
    const description = [
      `NEXUS Recruitments '26 - ${dept?.name ?? app.department} interview.`,
      modeLine,
      "Panel: NEXUS core team, VIT Chennai.",
      `Full details live in your application status: ${siteUrl}/apply`,
    ].join("\n");

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//NEXUS VITC//Recruitments 26//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:nexus-interview-${app.id}@nexus.runs-on.dev`,
      `DTSTAMP:${icsStamp(new Date().toISOString())}`,
      `DTSTART:${icsStamp(start.toISOString())}`,
      `DTEND:${icsStamp(end.toISOString())}`,
      `SUMMARY:${icsEscape(`NEXUS Interview - ${dept?.name ?? app.department}`)}`,
      `DESCRIPTION:${icsEscape(description)}`,
      `LOCATION:${icsEscape(modeLocation(app.interviewMode))}`,
      `URL:${siteUrl}/apply`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "BEGIN:VALARM",
      `TRIGGER:-PT${INTERVIEW_DURATION_MIN}M`,
      "ACTION:DISPLAY",
      `DESCRIPTION:${icsEscape("NEXUS interview in 30 minutes - good luck, builder.")}`,
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR",
    ];

    return new Response(lines.join("\r\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'attachment; filename="nexus-interview.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[api/application/ics] failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
