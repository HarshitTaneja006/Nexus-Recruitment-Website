import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Optional Supabase integration.
 *
 * The recruitment portal stores everything locally via Prisma by default.
 * As soon as the following env vars are provided, applications and drafts
 * are persisted to Supabase instead (see supabase/schema.sql for the table
 * definitions to run once in your Supabase SQL editor):
 *
 *   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
 *   SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   (server-side only)
 *
 * The service-role key bypasses RLS and must never reach the browser —
 * this module is only imported from server code.
 */

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseServiceKey) return null;
  if (!cached) {
    cached = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cached;
}

/** Table names used by the storage layer. */
export const SUPABASE_TABLES = {
  applications: "applications",
  drafts: "application_drafts",
  notifications: "status_notifications",
} as const;
