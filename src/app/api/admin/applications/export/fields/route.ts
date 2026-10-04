import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin";
import {
  COMMON_QUESTIONS,
  DEPARTMENTS,
  LEGACY_QUESTION_LABELS,
} from "@/lib/departments";
import { EXPORT_FIELD_GROUPS, buildExportFields } from "@/lib/export-fields";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/applications/export/fields
 * Field catalog for the custom-export dialog (admin only): grouped keys +
 * human labels, including every known application question.
 */
export async function GET() {
  const adminEmail = await getAdminSession();
  if (!adminEmail) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }
  const defs = await buildExportFields();
  const labels = new Map<string, string>();
  for (const q of COMMON_QUESTIONS) labels.set(q.id, q.label);
  for (const d of DEPARTMENTS) for (const q of d.questions) labels.set(q.id, q.label);
  for (const [id, label] of Object.entries(LEGACY_QUESTION_LABELS)) {
    if (!labels.has(id)) labels.set(id, label);
  }
  return NextResponse.json({
    groups: EXPORT_FIELD_GROUPS,
    fields: defs.map((d) => ({
      key: d.key,
      label: labels.get(d.key) ?? d.label,
      group: d.group,
    })),
    defaults: defs.map((d) => d.key),
  });
}
