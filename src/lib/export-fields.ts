import type { ApplicationRecord } from "@/lib/storage";

/**
 * Custom export field registry - single source of truth for the
 * review-console EXPORT dialog + the /export API.
 *
 * Each entry maps a stable `key` (used in `?fields=a,b`) to a CSV header
 * and a row extractor. Question answers (common_* / tech_* / ...) are
 * appended dynamically from DEPARTMENTS so new questions need no edit here.
 */

export type ExportFieldGroup =
  | "identity"
  | "review"
  | "interview"
  | "links"
  | "round1"
  | "answers";

export interface ExportFieldDef {
  key: string;
  label: string;
  group: ExportFieldGroup;
  get: (r: ApplicationRecord) => unknown;
}

export const EXPORT_FIELD_GROUPS: Array<{
  id: ExportFieldGroup;
  label: string;
}> = [
  { id: "identity", label: "IDENTITY" },
  { id: "review", label: "REVIEW" },
  { id: "interview", label: "INTERVIEW" },
  { id: "links", label: "LINKS" },
  { id: "round1", label: "ROUND 1" },
  { id: "answers", label: "ANSWERS" },
];

const BASE_FIELDS: ExportFieldDef[] = [
  { key: "app_id", label: "app_id", group: "identity", get: (r) => r.id },
  { key: "submitted_at", label: "submitted_at", group: "identity", get: (r) => r.submittedAt },
  { key: "updated_at", label: "updated_at", group: "identity", get: (r) => r.updatedAt },
  { key: "full_name", label: "full_name", group: "identity", get: (r) => r.fullName },
  { key: "email", label: "email", group: "identity", get: (r) => r.email },
  { key: "whatsapp", label: "whatsapp", group: "identity", get: (r) => r.whatsapp ?? "" },
  { key: "join_year", label: "join_year", group: "identity", get: (r) => r.joinYear },
  { key: "year_of_study", label: "year_of_study", group: "identity", get: (r) => r.yearOfStudy },
  { key: "department", label: "department", group: "identity", get: (r) => r.department },

  { key: "status", label: "status", group: "review", get: (r) => r.status },
  { key: "status_note", label: "status_note", group: "review", get: (r) => r.statusNote ?? "" },
  { key: "panel_note", label: "panel_note", group: "review", get: (r) => r.panelNote ?? "" },
  { key: "reviewed_by", label: "reviewed_by", group: "review", get: (r) => r.reviewedBy ?? "" },
  {
    key: "status_updated_at",
    label: "status_updated_at",
    group: "review",
    get: (r) => r.statusUpdatedAt ?? "",
  },

  { key: "interview_at", label: "interview_at", group: "interview", get: (r) => r.interviewAt ?? "" },
  {
    key: "interview_mode",
    label: "interview_mode",
    group: "interview",
    get: (r) => r.interviewMode ?? "",
  },
  {
    key: "interview_panel",
    label: "interview_panel",
    group: "interview",
    get: (r) => r.interviewPanel ?? "",
  },

  { key: "github", label: "github", group: "links", get: (r) => r.links?.github ?? "" },
  { key: "linkedin", label: "linkedin", group: "links", get: (r) => r.links?.linkedin ?? "" },
  {
    key: "portfolio",
    label: "portfolio",
    group: "links",
    get: (r) => r.links?.portfolio ?? "",
  },

  {
    key: "round1_problem_statement",
    label: "round1_problem_statement",
    group: "round1",
    get: (r) => r.round1ProblemStatement ?? "",
  },
  {
    key: "round1_github_url",
    label: "round1_github_url",
    group: "round1",
    get: (r) => r.round1GithubUrl ?? "",
  },
  {
    key: "round1_report_url",
    label: "round1_report_url",
    group: "round1",
    get: (r) => r.round1ReportUrl ?? "",
  },
  {
    key: "round1_deploy_url",
    label: "round1_deploy_url",
    group: "round1",
    get: (r) => r.round1DeployUrl ?? "",
  },
  {
    key: "round1_submitted_at",
    label: "round1_submitted_at",
    group: "round1",
    get: (r) => r.round1SubmittedAt ?? "",
  },
];

/** Base keys in legacy full-export order - the default selection. */
export const DEFAULT_EXPORT_FIELDS: string[] = [
  ...BASE_FIELDS.map((f) => f.key),
  // answers appended by buildExportFields()
];

/**
 * Full field list = base fields + every known question id (common first,
 * then per-department). Imported lazily to keep this module client-safe
 * (departments.ts has no server imports).
 */
export async function buildExportFields(): Promise<ExportFieldDef[]> {
  const { COMMON_QUESTIONS, DEPARTMENTS } = await import("@/lib/departments");
  const questionIds = [
    ...COMMON_QUESTIONS.map((q) => q.id),
    ...DEPARTMENTS.flatMap((d) => d.questions.map((q) => q.id)),
  ];
  const seen = new Set(BASE_FIELDS.map((f) => f.key));
  const answerFields: ExportFieldDef[] = [];
  for (const id of questionIds) {
    if (seen.has(id)) continue;
    seen.add(id);
    answerFields.push({
      key: id,
      label: id,
      group: "answers",
      get: (r) => r.answers?.[id] ?? "",
    });
  }
  return [...BASE_FIELDS, ...answerFields];
}

/** Synchronous base-only lookup (for validation without question ids). */
export function isBaseExportField(key: string): boolean {
  return BASE_FIELDS.some((f) => f.key === key);
}

/** Resolve requested keys → ordered defs; unknown keys dropped. */
export async function resolveExportFields(
  requested: string[] | undefined
): Promise<ExportFieldDef[]> {
  const all = await buildExportFields();
  if (!requested || requested.length === 0) return all;
  const order = new Map(requested.map((k, i) => [k, i]));
  return all
    .filter((f) => order.has(f.key))
    .sort((a, b) => (order.get(a.key) ?? 0) - (order.get(b.key) ?? 0));
}

/** All valid keys (base + questions) - for API validation. */
export async function allExportFieldKeys(): Promise<Set<string>> {
  const all = await buildExportFields();
  return new Set(all.map((f) => f.key));
}

/** Default = everything (backwards-compatible with the old full CSV). */
export async function defaultExportFields(): Promise<ExportFieldDef[]> {
  return buildExportFields();
}
