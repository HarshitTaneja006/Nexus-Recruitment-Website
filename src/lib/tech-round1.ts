/**
 * Tech Round 1 (SHORTLISTED_R1) configuration - client-safe.
 *
 * Technical shortlists run in two stages:
 *   R1 = project round: read the brief PDF, submit github + report
 *        (+ optional deploy link) before the deadline. No interview slot.
 *   R2 = interview round: behaves like SHORTLISTED (slot + mode + panel).
 *
 * The brief PDF lives in the repo at public/tech-round1-brief.pdf -
 * drop the file there (same name) and this URL starts working with
 * zero code changes. Until then the panel shows a "brief dropping
 * soon" fallback instead of a broken button.
 */

import { z } from "zod";

/** Served from public/ - core uploads the PDF to this exact path. */
export const TECH_ROUND1_BRIEF_URL = "/tech-round1-brief.pdf";

/** Fallback deadline when core hasn't set one yet (7 days, IST evening). */
export const TECH_ROUND1_DEFAULT_DEADLINE_DAYS = 7;

const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[\w-]{2,}(\/\S*)?$/i;

const requiredUrl = (requiredMsg: string) =>
  z
    .string()
    .trim()
    .min(1, requiredMsg)
    .max(500)
    .refine((v) => URL_RE.test(v), "Enter a valid URL (https://…)");

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || URL_RE.test(v), "Enter a valid URL")
  .optional()
  .or(z.literal(""));

/** Student hand-in payload: github + report required, deploy optional. */
export const techRound1Schema = z.object({
  githubUrl: requiredUrl("Paste your GitHub repo link"),
  reportUrl: requiredUrl("Paste your report link (drive / docs / pdf url)"),
  deployUrl: optionalUrl,
});

export type TechRound1Input = z.infer<typeof techRound1Schema>;

/** Eligible for the Round 1 screen: tech dept + R1 status. */
export function isTechRound1Candidate(department: string, status: string): boolean {
  return department === "technical" && status === "SHORTLISTED_R1";
}

/** IST formatting for the deadline countdown header. */
export function formatRound1Deadline(iso: string | null): string {
  if (!iso) return "to be announced";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "to be announced";
  return (
    d.toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " IST"
  );
}

/** ms remaining until the deadline (<= 0 = closed). Null deadline = open. */
export function round1MsRemaining(deadlineIso: string | null, now = Date.now()): number | null {
  if (!deadlineIso) return null;
  const t = new Date(deadlineIso).getTime();
  if (Number.isNaN(t)) return null;
  return t - now;
}
