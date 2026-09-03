import { z } from "zod";
import {
  COMMON_QUESTIONS,
  DEPARTMENTS,
  getDepartment,
  type Question,
} from "./departments";

/** Build a per-question validator from the question config. */
function questionSchema(q: Question) {
  let base = z.string();
  if (q.required) {
    base = base
      .trim()
      .min(q.minLength ?? 1, `Minimum ${q.minLength} characters required`)
      .max(q.maxLength ?? 4000, "Too long");
  } else {
    base = base
      .max(q.maxLength ?? 4000, "Too long")
      .refine(
        (v) => !v || v.trim().length >= (q.minLength ?? 0),
        `Minimum ${q.minLength} characters required`
      );
  }
  return base;
}

export const departmentIdSchema = z
  .string()
  .min(1, "Select a department")
  .refine((v) => DEPARTMENTS.some((d) => d.id === v), "Unknown department");

/**
 * WhatsApp number: 8–15 digits, optional leading +, and common separators.
 * Indian numbers (10 digits) pass as-is; +91… and other country codes too.
 */
export const whatsappSchema = z
  .string()
  .trim()
  .refine(
    (v) => /^\+?[0-9][0-9 \-]{6,18}[0-9]$/.test(v) &&
      /^[+]?[0-9 \-]+$/.test(v) &&
      v.replace(/[^0-9]/g, "").length >= 8 &&
      v.replace(/[^0-9]/g, "").length <= 15,
    "Enter a valid WhatsApp number (8–15 digits, +country code allowed)"
  );

/** Answers must cover every required question of the chosen department. */
export function buildAnswersSchema(departmentId: string) {
  const dept = getDepartment(departmentId);
  if (!dept) return z.record(z.string(), z.string());
  const questions = [...COMMON_QUESTIONS, ...dept.questions];
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const q of questions) shape[q.id] = questionSchema(q);
  return z.object(shape).loose();
}

export const linksSchema = z
  .object({
    github: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) => !v || /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v),
        "Enter a valid URL"
      )
      .optional()
      .or(z.literal("")),
    linkedin: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) => !v || /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v),
        "Enter a valid URL"
      )
      .optional()
      .or(z.literal("")),
    portfolio: z
      .string()
      .trim()
      .max(200)
      .refine(
        (v) => !v || /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i.test(v),
        "Enter a valid URL"
      )
      .optional()
      .or(z.literal("")),
  })
  .optional();

export const submitApplicationSchema = z.object({
  department: departmentIdSchema,
  whatsapp: whatsappSchema,
  answers: z.record(z.string(), z.string()),
  links: linksSchema,
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;

export const draftSchema = z.object({
  department: z.string().max(40).default(""),
  whatsapp: z.string().max(24).default(""),
  answers: z.record(z.string(), z.string().max(4000)),
  links: z
    .object({
      github: z.string().max(200).default(""),
      linkedin: z.string().max(200).default(""),
      portfolio: z.string().max(200).default(""),
    })
    .default({ github: "", linkedin: "", portfolio: "" }),
  updatedAt: z.string().optional(),
});

export type DraftData = z.infer<typeof draftSchema>;

/** Human-friendly error strings from a Zod error, keyed by question id. */
export function zodErrorsToFieldMap(error: z.ZodError): Record<string, string> {
  const map: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!map[key]) map[key] = issue.message;
  }
  return map;
}
