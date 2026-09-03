/**
 * VIT student email utilities.
 *
 * Canonical format (per recruitment rules):
 *   firstname.lastname<yearOfJoining>@vitstudent.ac.in
 *   e.g.  harshit.taneja2023@vitstudent.ac.in
 *
 * Everything (name, year of study) is DERIVED from the email — students
 * never type it manually, which keeps records clean and verifiable.
 */

export const VIT_EMAIL_DOMAIN = "vitstudent.ac.in";

/** Strictly firstname.lastname<4-digit-year>@vitstudent.ac.in */
export const VIT_EMAIL_REGEX =
  /^([a-z]+)\.([a-z]+)(\d{4})@vitstudent\.ac\.in$/i;

export interface VitEmailProfile {
  /** Raw email exactly as received from Google (lowercased for parsing) */
  email: string;
  firstName: string;
  lastName: string;
  /** "Harshit Taneja" */
  fullName: string;
  /** Year the student joined VIT, e.g. 2023 */
  joinYear: number;
  /** 1..5 — derived from joinYear against the current academic year */
  yearOfStudy: number;
}

function capitalize(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Academic year at VIT starts in July.
 * joinYear 2023 in Feb 2026 → academicStart 2025 → 3rd year.
 */
export function computeYearOfStudy(joinYear: number, now = new Date()): number {
  const month = now.getMonth(); // 0-based; July === 6
  const academicStartYear = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  return Math.min(5, Math.max(1, academicStartYear - joinYear + 1));
}

export function isValidVitEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const match = VIT_EMAIL_REGEX.exec(email.trim());
  if (!match) return false;
  const joinYear = Number(match[3]);
  const currentYear = new Date().getFullYear();
  // plausible joining years: VIT Chennai founded 2010; allow next year (admits)
  return joinYear >= 2010 && joinYear <= currentYear + 1;
}

/** Parse a valid VIT email into a full identity profile. Returns null if invalid. */
export function parseVitEmail(
  email: string | null | undefined,
  now = new Date()
): VitEmailProfile | null {
  if (!email) return null;
  const match = VIT_EMAIL_REGEX.exec(email.trim());
  if (!match) return null;
  const [, rawFirst, rawLast, rawYear] = match;
  const firstName = capitalize(rawFirst);
  const lastName = capitalize(rawLast);
  const joinYear = Number(rawYear);
  return {
    email: email.trim().toLowerCase(),
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    joinYear,
    yearOfStudy: computeYearOfStudy(joinYear, now),
  };
}

export const YEAR_ORDINALS: Record<number, string> = {
  1: "1st",
  2: "2nd",
  3: "3rd",
  4: "4th",
  5: "5th",
};

export function formatYearOfStudy(year: number): string {
  return `${YEAR_ORDINALS[year] ?? year} Year`;
}

export const VIT_EMAIL_HINT = "firstname.lastnameYYYY@vitstudent.ac.in";
export const VIT_EMAIL_EXAMPLE = "harshit.taneja2026@vitstudent.ac.in";
