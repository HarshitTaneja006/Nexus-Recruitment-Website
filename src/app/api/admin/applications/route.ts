import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getDepartment } from "@/lib/departments";
import { isApplicationStatus } from "@/lib/status";
import { getDriveStats, listApplications } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/applications?department=&status=&year=&q=&order=
 * Allowlist-gated listing for the review console.
 */
export async function GET(req: NextRequest) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const department = params.get("department") ?? "";
  const statusParam = params.get("status") ?? "";
  const yearParam = Number(params.get("year") ?? "");
  const year =
    Number.isInteger(yearParam) && yearParam >= 1 && yearParam <= 5
      ? yearParam
      : undefined;
  const q = params.get("q")?.trim() ?? "";
  const orderParam = params.get("order");
  const order =
    orderParam === "oldest" || orderParam === "name" || orderParam === "newest"
      ? orderParam
      : "newest";

  try {
    const [applications, stats] = await Promise.all([
      listApplications({
        department: getDepartment(department) ? department : undefined,
        status: isApplicationStatus(statusParam) ? statusParam : undefined,
        year,
        q: q || undefined,
        order,
      }),
      getDriveStats(),
    ]);
    return NextResponse.json({ applications, stats, adminEmail });
  } catch (err) {
    console.error("[api/admin/applications] failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
