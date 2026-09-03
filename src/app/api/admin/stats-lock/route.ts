import { NextResponse } from "next/server";
import { z } from "zod";
import { timingSafeEqual } from "node:crypto";
import { getAdminSession } from "@/lib/admin";
import { isStatsPublic, setSetting } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  enabled: z.boolean(),
  password: z.string().min(1, "The unlock secret is required").max(200),
});

function secretMatches(input: string): boolean {
  const expected = process.env.STATS_LOCK_SECRET ?? "";
  if (!expected) return false; // no secret configured → sealed forever (safe default)
  const a = Buffer.from(input.trim());
  const b = Buffer.from(expected.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * GET /api/admin/stats-lock — current public-stats flag (admin only).
 * POST /api/admin/stats-lock — {enabled, password}: flip the flag; the
 * STATS_LOCK_SECRET is required for BOTH directions so a stray click can
 * never publish (or hide) the funnel.
 */
export async function GET() {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const enabled = await isStatsPublic();
  const configured = Boolean(process.env.STATS_LOCK_SECRET);
  return NextResponse.json({ enabled, configured });
}

export async function POST(req: Request) {
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
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "VALIDATION_FAILED" }, { status: 400 });
  }

  if (!secretMatches(parsed.data.password)) {
    return NextResponse.json(
      { error: "BAD_SECRET", message: "Wrong unlock secret — the console stays sealed." },
      { status: 403 }
    );
  }

  await setSetting("stats_public", parsed.data.enabled ? "1" : "0");
  return NextResponse.json({ enabled: parsed.data.enabled });
}
