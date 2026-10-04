import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import { getDepartment } from "@/lib/departments";
import { isApplicationStatus } from "@/lib/status";
import { exportApplicationsCsv, exportApplicationsJson } from "@/lib/storage";
import { allExportFieldKeys } from "@/lib/export-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/applications/export
 * Custom export (admin only) - respects console filters, plus:
 *   ids=uuid1,uuid2   explicit record picker (ticked rows); combined with filters
 *   fields=a,b,c      caller-chosen columns (unknown keys dropped, max 60)
 *   format=csv|json   default csv
 *   status=A,B        single or comma-list (matches the listing API)
 *
 * No fields param = full legacy CSV (backwards-compatible).
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
  const order: "newest" | "oldest" | "name" =
    orderParam === "oldest" || orderParam === "name" || orderParam === "newest"
      ? orderParam
      : "newest";
  const format = params.get("format") === "json" ? "json" : "csv";

  const statuses = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter((s) => isApplicationStatus(s));

  const ids = (params.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 500);

  // fields=a,b + repeatable ?fields=a&fields=b both accepted
  const rawFields = [
    ...params.getAll("fields").flatMap((v) => v.split(",")),
  ]
    .map((s) => s.trim())
    .filter(Boolean);
  let fields: string[] | undefined;
  if (rawFields.length > 0) {
    const valid = await allExportFieldKeys();
    const deduped: string[] = [];
    for (const k of rawFields) {
      if (valid.has(k) && !deduped.includes(k)) deduped.push(k);
    }
    if (deduped.length === 0) {
      return NextResponse.json({ error: "NO_VALID_FIELDS" }, { status: 400 });
    }
    fields = deduped.slice(0, 60);
  }

  try {
    const base = {
      department: getDepartment(department) ? department : undefined,
      status: statuses.length === 1 ? statuses[0] : undefined,
      statuses: statuses.length > 1 ? statuses : undefined,
      year,
      q: q || undefined,
      order,
      ids: ids.length > 0 ? ids : undefined,
      fields,
    };
    const stamp = new Date().toISOString().slice(0, 10);
    const scope = [department, statuses.join("+"), year ? `year-${year}` : "", ids.length > 0 ? `${ids.length}-picked` : ""]
      .filter(Boolean)
      .join("-");

    if (format === "json") {
      const { rows, count, columns } = await exportApplicationsJson(base);
      return NextResponse.json(
        { count, columns, rows, exportedAt: new Date().toISOString() },
        {
          headers: {
            "Content-Disposition": `attachment; filename="nexus-applications${scope ? `-${scope}` : ""}-${stamp}.json"`,
          },
        }
      );
    }

    const { csv, count } = await exportApplicationsCsv(base);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nexus-applications${scope ? `-${scope}` : ""}-${stamp}.csv"`,
        "X-Export-Count": String(count),
      },
    });
  } catch (err) {
    console.error("[api/admin/applications/export] failed:", err);
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
