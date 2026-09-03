import { getAuthSession } from "@/lib/auth";

/**
 * Admin access for the review console.
 * ADMIN_EMAILS is a comma-separated allowlist of VIT emails
 * (e.g. "core.nexus2023@vitstudent.ac.in,president2024@vitstudent.ac.in").
 */
export function getAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

/** Returns the admin's email, or null when the session is not an allowlisted admin. */
export async function getAdminSession(): Promise<string | null> {
  const session = await getAuthSession();
  const email = session?.user?.email ?? null;
  return isAdminEmail(email) ? email : null;
}
