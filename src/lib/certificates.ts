import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase";

/**
 * Acceptance certificates - Supabase Storage backing.
 *
 * Convention (agreed with core):
 *   bucket : "certificates" (private, service_role only)
 *   object : "<email-local-part>.png" at the bucket root, lowercased
 *            e.g. harshit.taneja2025@vitstudent.ac.in → harshit.taneja2025.png
 *
 * Certificates are attached ONLY at flush time (the outbox drain
 * downloads the PNG and hands it to nodemailer). Queue time never
 * touches storage, so uploading certs after the review action but
 * before the flush is a supported workflow. A drain refuses to deliver
 * an acceptance mail while its PNG is absent from the bucket.
 */

/** Private bucket holding the acceptance PNGs. */
export const CERTIFICATE_BUCKET = "certificates";

/** MIME type assumed for every certificate object. */
export const CERTIFICATE_CONTENT_TYPE = "image/png";

/** File-level cap so a rogue PNG cannot OOM the drain worker (8 MiB). */
export const CERTIFICATE_MAX_BYTES = 8 * 1024 * 1024;

/**
 * Map a student email to its certificate object path.
 * Lowercased local-part + ".png", with path separators stripped so a
 * crafted email can never escape the bucket root.
 */
export function certificatePathForEmail(email: string): string {
  const local = email.trim().toLowerCase().split("@")[0] ?? "";
  const safe = local.replace(/[^a-z0-9._-]/g, "");
  return `${safe || "unknown"}.png`;
}

/**
 * True when an outbox row is an acceptance mail. The drain gates only
 * these rows on the certificate bucket; every other type flushes as
 * before. Matched on the canonical subject line
 * ("[NEXUS '26] Application update - ACCEPTED") with a body fallback
 * for rows queued before this feature shipped.
 */
export function isAcceptanceNotification(row: {
  subject: string;
  body: string;
}): boolean {
  if (/ACCEPTED/i.test(row.subject ?? "")) return true;
  return /moved to ACCEPTED/i.test(row.body ?? "");
}

/** Missing-object fingerprints across Supabase/PostgREST error shapes. */
function isMissingObjectError(message: string): boolean {
  return /not found|no such|does not exist|404/i.test(message);
}

export interface CertificateAttachment {
  /** object path inside the bucket, e.g. "harshit.taneja2025.png" */
  path: string;
  /** file bytes for the nodemailer attachment */
  content: Buffer;
  /** always image/png */
  contentType: string;
  /** attachment filename the student sees */
  filename: string;
}

/**
 * Download the certificate for an email. Returns null when the object
 * is absent (caller marks the row CERT_MISSING and keeps it QUEUED).
 * Throws on storage misconfiguration or transport errors.
 */
export async function fetchCertificateForEmail(
  email: string
): Promise<CertificateAttachment | null> {
  const path = certificatePathForEmail(email);
  if (!isSupabaseConfigured) {
    throw new Error(
      `certificate storage not configured - cannot verify ${CERTIFICATE_BUCKET}/${path}`
    );
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new Error("certificate storage not configured (supabase client null)");
  }
  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .download(path);
  if (error) {
    if (isMissingObjectError(error.message)) return null;
    throw new Error(`certificate download failed: ${error.message}`);
  }
  if (!data) return null;
  const buffer = Buffer.from(await data.arrayBuffer());
  if (buffer.length === 0) return null;
  if (buffer.length > CERTIFICATE_MAX_BYTES) {
    throw new Error(
      `certificate too large: ${CERTIFICATE_BUCKET}/${path} (${buffer.length} bytes)`
    );
  }
  return {
    path,
    content: buffer,
    contentType: CERTIFICATE_CONTENT_TYPE,
    filename: path.split("/").pop() ?? path,
  };
}

/**
 * Cheap existence probe for the admin console (no bytes transferred).
 * True when the object lists; false when absent. Throws on transport
 * errors so real outages are not mistaken for a missing PNG.
 */
export async function certificateExistsForEmail(
  email: string
): Promise<{ path: string; exists: boolean }> {
  const path = certificatePathForEmail(email);
  if (!isSupabaseConfigured) {
    throw new Error("certificate storage not configured");
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) throw new Error("certificate storage not configured");
  const { data, error } = await supabase.storage
    .from(CERTIFICATE_BUCKET)
    .list("", { search: path });
  if (error) {
    if (isMissingObjectError(error.message)) return { path, exists: false };
    throw new Error(`certificate lookup failed: ${error.message}`);
  }
  return { path, exists: (data ?? []).some((f) => f.name === path) };
}
