import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { isStatsPublic, getDriveStats } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/stats — drive statistics for the landing page + /stats console.
 * SEALED by default: when core has not unlocked `stats_public`, the funnel
 * answers 403 {locked:true} to everyone except allowlisted admins (their
 * console still renders live numbers).
 */
export async function GET() {
  try {
    const isPublic = await isStatsPublic();
    if (!isPublic) {
      const adminEmail = await getAdminSession();
      if (!adminEmail) {
        return NextResponse.json(
          { locked: true, message: "The live funnel is sealed by the core team." },
          { status: 403 }
        );
      }
    }
    const stats = await getDriveStats();
    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/stats] failed:", err);
    return NextResponse.json(
      {
        total: 0,
        byDepartment: {},
        byDepartmentStatus: {},
        byJoinYear: {},
        last24h: 0,
        generatedAt: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
