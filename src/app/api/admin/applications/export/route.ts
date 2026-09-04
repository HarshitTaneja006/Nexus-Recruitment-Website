import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getDepartment } from "@/lib/departments";
import { isApplicationStatus } from "@/lib/status";
import { exportApplicationsCsv } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/applications/export?department=&status=&year=&q=&order=
 * CSV download (admin only) - respects the console's active filters so
 * what you see on screen is what lands in the file.
 */
export async function GET(req: NextRequest) {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const department = params.get("department") ?? "";
  const status = params.get("status") ?? "";
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
    const csv = await exportApplicationsCsv({
      department: getDepartment(department) ? department : undefined,
      status: isApplicationStatus(status) ? status : undefined,
      year,
      q: q || undefined,
      order,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = [department, status, year ? `year-${year}` : ""].filter(Boolean).join("-");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nexus-applications${scope ? `-${scope}` : ""}-${stamp}.csv"`,
      },
    });
  } catch (err) {
    console.error("[api/admin/applications/export] failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
