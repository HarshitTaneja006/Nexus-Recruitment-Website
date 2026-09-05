import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getSupabaseAdmin, isSupabaseConfigured, SUPABASE_TABLES } from "@/lib/supabase";
import type { DraftData, SubmitApplicationInput } from "@/lib/validation";
import type { Links } from "@/lib/departments";
import type { StatusEvent } from "@/lib/status";
import { parseStatusHistory } from "@/lib/status";

/**
 * Storage layer - Prisma (local SQLite) by default, Supabase when configured.
 * The rest of the app only calls these functions, so switching backends
 * requires zero changes elsewhere.
 */

export interface ApplicationRecord {
  id: string;
  email: string;
  fullName: string;
  joinYear: number;
  yearOfStudy: number;
  department: string;
  whatsapp: string;
  answers: Record<string, string>;
  links: Links;
  status: string;
  statusNote: string | null;
  /** internal core-team note - admin-only, never sent to the student */
  panelNote: string | null;
  statusUpdatedAt: string | null;
  reviewedBy: string | null;
  interviewAt: string | null;
  interviewMode: string | null;
  clarificationQuestion: string | null;
  clarificationAnswer: string | null;
  clarificationAskedAt: string | null;
  clarificationAnsweredAt: string | null;
  statusHistory: StatusEvent[];
  submittedAt: string;
  updatedAt: string;
}

/** One queued/SENT row in the notification outbox (SMTP/Edge hook point). */
export interface NotificationRecord {
  id: string;
  applicationId: string;
  email: string;
  fullName: string;
  type: string;
  subject: string;
  body: string;
  channel: string;
  status: string;
  lastError: string | null;
  createdAt: string;
  sentAt: string | null;
}

export interface DraftRecord {
  data: DraftData;
  updatedAt: string;
}

export interface DriveStats {
  total: number;
  byDepartment: Record<string, number>;
  /** department → status → count, for the stacked review-pipeline bars */
  byDepartmentStatus: Record<string, Record<string, number>>;
  /** joining-year cohort → count (public-safe aggregate, e.g. "2024" → 3) */
  byJoinYear: Record<string, number>;
  /** applications submitted in the trailing 24h - drive velocity */
  last24h: number;
  /** day-bucket submission counts for the trailing window, IST days, oldest → newest */
  timeline: Array<{ date: string; count: number }>;
  /** same day-buckets, per department - powers the /stats domain filter */
  timelineByDept: Record<string, Array<{ date: string; count: number }>>;
  generatedAt: string;
}

/* ------------------------------------------------------------------ */
/* User registry                                                       */
/* ------------------------------------------------------------------ */

/** Upsert the user row and return its real id (FK target for app + draft). */
export async function resolveUserId(email: string, name?: string): Promise<string> {
  const user = await db.user.upsert({
    where: { email },
    update: name ? { name } : {},
    create: { email, name },
  });
  return user.id;
}

/** Best-effort lookup - null when the user has never signed in. */
export async function lookupUserId(email: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { email } });
  return user?.id ?? null;
}

/* ------------------------------------------------------------------ */
/* Applications                                                        */
/* ------------------------------------------------------------------ */

export async function submitApplication(params: {
  userId: string;
  email: string;
  fullName: string;
  joinYear: number;
  yearOfStudy: number;
  input: SubmitApplicationInput;
}): Promise<ApplicationRecord> {
  const links = params.input.links ?? { github: "", linkedin: "", portfolio: "" };

  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const row = {
        p_user_id: params.userId,
        p_email: params.email,
        p_full_name: params.fullName,
        p_join_year: params.joinYear,
        p_year_of_study: params.yearOfStudy,
        p_department: params.input.department,
        p_whatsapp: params.input.whatsapp,
        p_answers: params.input.answers,
        p_links: links,
      };
      const { data, error } = await supabase.rpc("submit_application", row);
      if (error) throw new Error(`Supabase submit failed: ${error.message}`);
      const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>;
      return mapApplicationRow(r);
    }
  }

  const saved = await db.application.upsert({
    where: { email: params.email },
    update: {
      userId: params.userId,
      fullName: params.fullName,
      joinYear: params.joinYear,
      yearOfStudy: params.yearOfStudy,
      department: params.input.department,
      whatsapp: params.input.whatsapp,
      answers: params.input.answers,
      links,
      updatedAt: new Date(),
    },
    create: {
      userId: params.userId,
      email: params.email,
      fullName: params.fullName,
      joinYear: params.joinYear,
      yearOfStudy: params.yearOfStudy,
      department: params.input.department,
      whatsapp: params.input.whatsapp,
      answers: params.input.answers,
      links,
    },
  });
  return mapApplicationRow(saved);
}

/** Admin review action - move an application along the status pipeline. */
export async function updateApplicationStatus(params: {
  id: string;
  status: string;
  note?: string | null;
  /** admin-only internal note - omitted (undefined) leaves it untouched */
  panelNote?: string | null;
  reviewedBy: string;
  /** interview slot (attaches to SHORTLISTED) */
  interviewAt?: string | null;
  interviewMode?: string | null;
}): Promise<ApplicationRecord | null> {
  const nowISO = new Date().toISOString();

  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      // read existing history to append the new event
      const { data: current } = await supabase
        .from(SUPABASE_TABLES.applications)
        .select("status_history")
        .eq("id", params.id)
        .maybeSingle();
      const history: StatusEvent[] = Array.isArray(current?.status_history)
        ? (current?.status_history as StatusEvent[])
        : [];
      history.push({
        status: params.status,
        note: params.note?.trim() ? params.note.trim() : null,
        by: params.reviewedBy,
        at: nowISO,
      });

      const { data, error } = await supabase
        .from(SUPABASE_TABLES.applications)
        .update({
          status: params.status,
          status_note: params.note ?? null,
          ...(params.panelNote !== undefined ? { panel_note: params.panelNote } : {}),
          status_updated_at: nowISO,
          reviewed_by: params.reviewedBy,
          interview_at: params.interviewAt ?? null,
          interview_mode: params.interviewMode ?? null,
          status_history: history,
          updated_at: nowISO,
        })
        .eq("id", params.id)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(`Supabase status update failed: ${error.message}`);
      return data ? mapApplicationRow(snakeToCamelRow(data)) : null;
    }
  }

  const existing = await db.application.findUnique({
    where: { id: params.id },
    select: { statusHistory: true },
  });
  const history: StatusEvent[] = parseStatusHistory(existing?.statusHistory);
  history.push({
    status: params.status,
    note: params.note?.trim() ? params.note.trim() : null,
    by: params.reviewedBy,
    at: nowISO,
  });

  const saved = await db.application.update({
    where: { id: params.id },
    data: {
      status: params.status,
      statusNote: params.note ?? null,
      ...(params.panelNote !== undefined ? { panelNote: params.panelNote } : {}),
      statusUpdatedAt: new Date(),
      reviewedBy: params.reviewedBy,
      interviewAt: params.interviewAt ? new Date(params.interviewAt) : null,
      interviewMode: params.interviewMode ?? null,
      statusHistory: history as unknown as Prisma.InputJsonValue,
    },
  });
  return mapApplicationRow(saved);
}

/**
 * Legacy helper from the clarification loop (status retired in Round 15).
 * Kept as a no-op guard so stale clients get a clean error instead of a 500.
 */
export async function answerClarification(): Promise<
  { ok: false; reason: "RETIRED" }
> {
  return { ok: false, reason: "RETIRED" };
}

export async function findApplicationByEmail(
  email: string
): Promise<ApplicationRecord | null> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.applications)
        .select("*")
        .eq("email", email)
        .maybeSingle();
      if (error) throw new Error(`Supabase read failed: ${error.message}`);
      return data ? mapApplicationRow(snakeToCamelRow(data)) : null;
    }
  }

  const row = await db.application.findUnique({ where: { email } });
  return row ? mapApplicationRow(row) : null;
}

/* ------------------------------------------------------------------ */
/* Drafts (server-side autosave mirror)                                */
/* ------------------------------------------------------------------ */

export async function upsertDraft(params: {
  userId: string;
  email: string;
  data: DraftData;
}): Promise<DraftRecord> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from(SUPABASE_TABLES.drafts)
        .upsert(
          {
            user_id: params.userId,
            email: params.email,
            data: params.data,
          },
          { onConflict: "user_id" }
        );
      if (error) throw new Error(`Supabase draft save failed: ${error.message}`);
      return { data: params.data, updatedAt: new Date().toISOString() };
    }
  }

  const saved = await db.applicationDraft.upsert({
    where: { userId: params.userId },
    update: { email: params.email, data: params.data, updatedAt: new Date() },
    create: {
      userId: params.userId,
      email: params.email,
      data: params.data,
    },
  });
  return {
    data: saved.data as unknown as DraftData,
    updatedAt: saved.updatedAt.toISOString(),
  };
}

export async function findDraft(userId: string): Promise<DraftRecord | null> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.drafts)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw new Error(`Supabase draft read failed: ${error.message}`);
      if (!data) return null;
      return {
        data: data.data as DraftData,
        updatedAt: String(data.updated_at ?? new Date().toISOString()),
      };
    }
  }

  const row = await db.applicationDraft.findUnique({ where: { userId } });
  return row
    ? {
        data: row.data as unknown as DraftData,
        updatedAt: row.updatedAt.toISOString(),
      }
    : null;
}

export async function deleteDraft(userId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase.from(SUPABASE_TABLES.drafts).delete().eq("user_id", userId);
      return;
    }
  }
  await db.applicationDraft.deleteMany({ where: { userId } });
}

/* ------------------------------------------------------------------ */
/* Public stats                                                        */
/* ------------------------------------------------------------------ */

let statsCache: { value: DriveStats; at: number } | null = null;
const STATS_TTL_MS = 30_000;

/** How many day-buckets the public sparkline covers. */
const TIMELINE_DAYS = 14;

/** YYYY-MM-DD label of the given instant, bucketed by calendar day in IST. */
function istDayKey(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/**
 * Dense trailing-window day series (zero-filled), for the submission
 * velocity sparkline on /stats. Days with no submissions still appear.
 * Returns the drive-wide series plus a per-department breakdown.
 */
function buildTimelines(rows: Array<{ department: string; at: Date | string | null | undefined }>): {
  timeline: DriveStats["timeline"];
  timelineByDept: DriveStats["timelineByDept"];
} {
  const globalCounts = new Map<string, number>();
  const deptCounts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    if (!row.at) continue;
    const d = row.at instanceof Date ? row.at : new Date(row.at);
    if (Number.isNaN(d.getTime())) continue;
    const key = istDayKey(d);
    globalCounts.set(key, (globalCounts.get(key) ?? 0) + 1);
    const dm = deptCounts.get(row.department) ?? new Map<string, number>();
    dm.set(key, (dm.get(key) ?? 0) + 1);
    deptCounts.set(row.department, dm);
  }
  const now = Date.now();
  const timeline: DriveStats["timeline"] = [];
  const timelineByDept: DriveStats["timelineByDept"] = {};
  for (const dept of deptCounts.keys()) timelineByDept[dept] = [];
  for (let i = TIMELINE_DAYS - 1; i >= 0; i--) {
    const key = istDayKey(new Date(now - i * 86_400_000));
    timeline.push({ date: key, count: globalCounts.get(key) ?? 0 });
    for (const [dept, dm] of deptCounts) {
      timelineByDept[dept].push({ date: key, count: dm.get(key) ?? 0 });
    }
  }
  return { timeline, timelineByDept };
}

export async function getDriveStats(): Promise<DriveStats> {
  if (statsCache && Date.now() - statsCache.at < STATS_TTL_MS) {
    return statsCache.value;
  }

  let value: DriveStats;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.applications)
        .select("department, status, join_year, submitted_at");
      if (error) throw new Error(`Supabase stats failed: ${error.message}`);
      const byDepartment: Record<string, number> = {};
      const byDepartmentStatus: Record<string, Record<string, number>> = {};
      const byJoinYear: Record<string, number> = {};
      let last24h = 0;
      const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
      for (const row of data ?? []) {
        byDepartment[row.department] = (byDepartment[row.department] ?? 0) + 1;
        const bucket = (byDepartmentStatus[row.department] ??= {});
        bucket[row.status] = (bucket[row.status] ?? 0) + 1;
        if (row.join_year != null) {
          const y = String(row.join_year);
          byJoinYear[y] = (byJoinYear[y] ?? 0) + 1;
        }
        if (row.submitted_at && Date.parse(row.submitted_at) >= dayAgo) last24h += 1;
      }
      value = {
        total: data?.length ?? 0,
        byDepartment,
        byDepartmentStatus,
        byJoinYear,
        last24h,
        ...buildTimelines((data ?? []).map((r) => ({ department: r.department, at: r.submitted_at }))),
        generatedAt: new Date().toISOString(),
      };
    } else {
      value = emptyStats();
    }
  } else {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const rows = await db.application.findMany({
      select: { department: true, status: true, joinYear: true, submittedAt: true },
    });
    const byDepartment: Record<string, number> = {};
    const byDepartmentStatus: Record<string, Record<string, number>> = {};
    const byJoinYear: Record<string, number> = {};
    let last24h = 0;
    for (const row of rows) {
      byDepartment[row.department] = (byDepartment[row.department] ?? 0) + 1;
      const bucket = (byDepartmentStatus[row.department] ??= {});
      bucket[row.status] = (bucket[row.status] ?? 0) + 1;
      const y = String(row.joinYear);
      byJoinYear[y] = (byJoinYear[y] ?? 0) + 1;
      if (row.submittedAt >= dayAgo) last24h += 1;
    }
    value = {
      total: rows.length,
      byDepartment,
      byDepartmentStatus,
      byJoinYear,
      last24h,
      ...buildTimelines(rows.map((r) => ({ department: r.department, at: r.submittedAt }))),
      generatedAt: new Date().toISOString(),
    };
  }

  statsCache = { value, at: Date.now() };
  return value;
}

/* ------------------------------------------------------------------ */
/* Admin: listing + CSV export                                         */
/* ------------------------------------------------------------------ */

export interface ListOptions {
  department?: string;
  status?: string;
  /** 1..5 - year of study */
  year?: number;
  q?: string;
  order?: "newest" | "oldest" | "name";
}

/**
 * Other applications holding an interview slot within ±windowMinutes of the
 * given slot - powers the "one panel, no overlaps" conflict warning. Only
 * applications currently parked on status=INTERVIEW count (an accepted or
 * rejected file with an old slot is not a conflict).
 */
export async function findInterviewConflicts(params: {
  excludeId: string;
  aroundIso: string;
  windowMinutes?: number;
}): Promise<
  Array<Pick<ApplicationRecord, "id" | "fullName" | "email" | "department" | "interviewAt" | "interviewMode">>
> {
  const win = params.windowMinutes ?? 45;
  const center = new Date(params.aroundIso);
  if (Number.isNaN(center.getTime())) return [];
  const from = new Date(center.getTime() - win * 60_000);
  const to = new Date(center.getTime() + win * 60_000);

  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.applications)
        .select("id, full_name, email, department, interview_at, interview_mode")
        .eq("status", "INTERVIEW")
        .neq("id", params.excludeId)
        .gte("interview_at", from.toISOString())
        .lte("interview_at", to.toISOString())
        .limit(10);
      if (error) throw new Error(`Supabase conflicts failed: ${error.message}`);
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: String(r.id ?? ""),
        fullName: String(r.full_name ?? ""),
        email: String(r.email ?? ""),
        department: String(r.department ?? ""),
        interviewAt: String(r.interview_at ?? ""),
        interviewMode: r.interview_mode == null ? null : String(r.interview_mode),
      }));
    }
  }

  const rows = await db.application.findMany({
    where: {
      status: "INTERVIEW",
      id: { not: params.excludeId },
      interviewAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      fullName: true,
      email: true,
      department: true,
      interviewAt: true,
      interviewMode: true,
    },
    take: 10,
  });
  return rows.map((r) => ({
    ...r,
    interviewAt: r.interviewAt ? r.interviewAt.toISOString() : "",
    interviewMode: r.interviewMode ?? null,
  }));
}

export async function listApplications(opts: ListOptions = {}): Promise<ApplicationRecord[]> {
  const order = opts.order ?? "newest";

  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      let query = supabase
        .from(SUPABASE_TABLES.applications)
        .select("*")
        .limit(500);
      if (opts.department) query = query.eq("department", opts.department);
      if (opts.status) query = query.eq("status", opts.status);
      if (opts.year) query = query.eq("year_of_study", opts.year);
      if (opts.q) {
        const like = `%${opts.q}%`;
        query = query.or(`full_name.ilike.${like},email.ilike.${like}`);
      }
      query =
        order === "oldest"
          ? query.order("submitted_at", { ascending: true })
          : order === "name"
            ? query.order("full_name", { ascending: true })
            : query.order("submitted_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw new Error(`Supabase list failed: ${error.message}`);
      return (data ?? []).map((row) =>
        mapApplicationRow(snakeToCamelRow(row as Record<string, unknown>))
      );
    }
  }

  const where: Record<string, unknown> = {};
  if (opts.department) where.department = opts.department;
  if (opts.status) where.status = opts.status;
  if (opts.year) where.yearOfStudy = opts.year;
  if (opts.q) {
    where.OR = [
      { email: { contains: opts.q } },
      { fullName: { contains: opts.q } },
    ];
  }
  const orderBy =
    order === "oldest"
      ? { submittedAt: "asc" as const }
      : order === "name"
        ? { fullName: "asc" as const }
        : { submittedAt: "desc" as const };
  const rows = await db.application.findMany({ where, orderBy, take: 500 });
  return rows.map((row) => mapApplicationRow(row));
}

/** CSV export of all (optionally filtered) applications. */
export async function exportApplicationsCsv(opts: ListOptions = {}): Promise<string> {
  const { COMMON_QUESTIONS, DEPARTMENTS } = await import("@/lib/departments");
  const rows = await listApplications(opts);

  const questionIds = [
    ...COMMON_QUESTIONS.map((q) => q.id),
    ...DEPARTMENTS.flatMap((d) => d.questions.map((q) => q.id)),
  ];

  const escape = (value: unknown): string => {
    let s = String(value ?? "");
    if (/^[=+\-@\t\r]/.test(s)) {
      s = `'${s}`;
    }
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = [
    "app_id",
    "submitted_at",
    "full_name",
    "email",
    "join_year",
    "year_of_study",
    "department",
    "whatsapp",
    "status",
    "interview_at",
    "interview_mode",
    "status_note",
    "github",
    "linkedin",
    "portfolio",
    ...questionIds,
  ];

  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.submittedAt,
        r.fullName,
        r.email,
        r.joinYear,
        r.yearOfStudy,
        r.department,
        r.whatsapp ?? "",
        r.status,
        r.interviewAt ?? "",
        r.interviewMode ?? "",
        r.statusNote ?? "",
        r.links?.github ?? "",
        r.links?.linkedin ?? "",
        r.links?.portfolio ?? "",
        ...questionIds.map((id) => r.answers?.[id] ?? ""),
      ]
        .map(escape)
        .join(",")
    );
  }
  return lines.join("\r\n");
}

/* ------------------------------------------------------------------ */
/* Notification outbox (SMTP / Supabase Edge hook point)              */
/* ------------------------------------------------------------------ */

export async function queueNotification(params: {
  applicationId: string;
  email: string;
  fullName: string;
  type: "STATUS_CHANGE" | "SUBMISSION_RECEIPT" | "DRAFT_REMINDER" | "CUSTOM";
  subject: string;
  body: string;
}): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_TABLES.notifications).insert({
        application_id: params.applicationId,
        email: params.email,
        full_name: params.fullName,
        type: params.type,
        subject: params.subject,
        body: params.body,
      });
      if (error) throw new Error(`Supabase queue failed: ${error.message}`);
      return;
    }
  }
  await db.statusNotification.create({
    data: {
      applicationId: params.applicationId,
      email: params.email,
      fullName: params.fullName,
      type: params.type,
      subject: params.subject,
      body: params.body,
    },
  });
}

/**
 * Direct-delivery audit: insert a notification row already resolved as
 * SENT or FAILED. Used by flows that email immediately (submission
 * receipts, review actions) instead of queueing - nothing lands in
 * QUEUED, so no drain/FLUSH_QUEUE step is needed. The outbox panel
 * still lists the row as history.
 */
export async function recordNotificationDelivery(params: {
  applicationId: string;
  email: string;
  fullName: string;
  type: "STATUS_CHANGE" | "SUBMISSION_RECEIPT" | "DRAFT_REMINDER" | "CUSTOM";
  subject: string;
  body: string;
  delivered: boolean;
  lastError?: string | null;
}): Promise<void> {
  const status = params.delivered ? "SENT" : "FAILED";
  const now = new Date();
  const lastError = params.delivered
    ? null
    : (params.lastError ?? "delivery failed").slice(0, 300);
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase.from(SUPABASE_TABLES.notifications).insert({
        application_id: params.applicationId,
        email: params.email,
        full_name: params.fullName,
        type: params.type,
        subject: params.subject,
        body: params.body,
        status,
        last_error: lastError,
        sent_at: params.delivered ? now.toISOString() : null,
      });
      if (error) throw new Error(`Supabase record failed: ${error.message}`);
      return;
    }
  }
  await db.statusNotification.create({
    data: {
      applicationId: params.applicationId,
      email: params.email,
      fullName: params.fullName,
      type: params.type,
      subject: params.subject,
      body: params.body,
      status,
      lastError,
      sentAt: params.delivered ? now : null,
    },
  });
}

export async function listNotifications(
  take = 50
): Promise<{ items: NotificationRecord[]; queued: number }> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.notifications)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(take);
      if (error) throw new Error(`Supabase outbox failed: ${error.message}`);
      const items = (data ?? []).map((row) =>
        mapNotificationRow(snakeToCamelRow(row as Record<string, unknown>))
      );
      return { items, queued: items.filter((n) => n.status === "QUEUED").length };
    }
  }

  const [items, queued] = await Promise.all([
    db.statusNotification.findMany({ orderBy: { createdAt: "desc" }, take }),
    db.statusNotification.count({ where: { status: "QUEUED" } }),
  ]);
  return {
    items: items.map((n) =>
      mapNotificationRow(n as unknown as Record<string, unknown>)
    ),
    queued,
  };
}

/**
 * Drain worker input: the oldest QUEUED rows (FIFO, like a real mail queue).
 * The drain route delivers each one via the provider and marks the outcome.
 */
export async function listQueuedNotifications(limit = 25): Promise<NotificationRecord[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.notifications)
        .select("*")
        .eq("status", "QUEUED")
        .order("created_at", { ascending: true })
        .limit(limit);
      if (error) throw new Error(`Supabase claim failed: ${error.message}`);
      return (data ?? []).map((row) =>
        mapNotificationRow(snakeToCamelRow(row as Record<string, unknown>))
      );
    }
  }
  const rows = await db.statusNotification.findMany({
    where: { status: "QUEUED" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
  return rows.map((n) => mapNotificationRow(n as unknown as Record<string, unknown>));
}

/** Drain worker outcome: a row failed delivery - keep it + the provider reason. */
export async function markNotificationFailed(id: string, reason: string): Promise<void> {
  const trimmed = reason.slice(0, 300);
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from(SUPABASE_TABLES.notifications)
        .update({ status: "FAILED", last_error: trimmed })
        .eq("id", id);
      if (error) throw new Error(`Supabase mark-failed failed: ${error.message}`);
      return;
    }
  }
  await db.statusNotification.updateMany({
    where: { id },
    data: { status: "FAILED", lastError: trimmed },
  });
}

/** Core-team recovery: re-queue a FAILED row so the next drain retries it. */
export async function requeueNotification(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.notifications)
        .update({ status: "QUEUED", last_error: null })
        .eq("id", id)
        .eq("status", "FAILED")
        .select("id");
      if (error) throw new Error(`Supabase requeue failed: ${error.message}`);
      return (data?.length ?? 0) > 0;
    }
  }
  const res = await db.statusNotification.updateMany({
    where: { id, status: "FAILED" },
    data: { status: "QUEUED", lastError: null },
  });
  return res.count > 0;
}

/** Claim one QUEUED row as SENT (a real worker calls nodemailer before this). */
export async function markNotificationSent(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { error } = await supabase
        .from(SUPABASE_TABLES.notifications)
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw new Error(`Supabase mark-sent failed: ${error.message}`);
      return true;
    }
  }
  const res = await db.statusNotification.updateMany({
    where: { id, status: "QUEUED" },
    data: { status: "SENT", sentAt: new Date() },
  });
  return res.count > 0;
}

export async function markAllNotificationsSent(): Promise<number> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      const { data, error } = await supabase
        .from(SUPABASE_TABLES.notifications)
        .update({ status: "SENT", sent_at: new Date().toISOString() })
        .eq("status", "QUEUED")
        .select("id");
      if (error) throw new Error(`Supabase flush failed: ${error.message}`);
      return data?.length ?? 0;
    }
  }
  const res = await db.statusNotification.updateMany({
    where: { status: "QUEUED" },
    data: { status: "SENT", sentAt: new Date() },
  });
  return res.count;
}

/* ------------------------------------------------------------------ */
/* Settings (key/value runtime flags)                                  */
/* ------------------------------------------------------------------ */

export type SettingKey = "stats_public";

export async function getSetting(key: SettingKey): Promise<string | null> {
  try {
    const row = await db.setting.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

/** Public stats console flag - disabled ("0") unless core explicitly unlocks it. */
export async function isStatsPublic(): Promise<boolean> {
  return (await getSetting("stats_public")) === "1";
}

/* ------------------------------------------------------------------ */
/* Draft reminders - students with progress but no submission          */
/* ------------------------------------------------------------------ */

export interface DraftReminderCandidate {
  email: string;
  fullName: string | null;
  department: string;
  updatedAt: string;
}

/**
 * Everyone with a server-side draft who has NOT submitted. Drives the
 * deadline-near reminder sweep. Supabase path: filter client-side.
 */
export async function listDraftReminderCandidates(): Promise<DraftReminderCandidate[]> {
  const drafts = await db.applicationDraft.findMany({
    select: { email: true, data: true, updatedAt: true },
    take: 1000,
  });
  const emails = drafts.map((d) => d.email);
  const submitted = await db.application.findMany({
    where: { email: { in: emails } },
    select: { email: true },
  });
  const submittedSet = new Set(submitted.map((a) => a.email));

  return drafts
    .filter((d) => !submittedSet.has(d.email))
    .map((d) => {
      const data = d.data as { department?: string };
      const user = d.email;
      return {
        email: user,
        fullName: deriveNameFromEmail(user),
        department: data?.department ?? "",
        updatedAt: d.updatedAt.toISOString(),
      };
    });
}

/** firstname.lastname2026@… → "Firstname Lastname" (best-effort, for mail merge). */
function deriveNameFromEmail(email: string): string | null {
  const local = email.split("@")[0] ?? "";
  const yearMatch = local.match(/(\d{4})$/);
  const namePart = yearMatch ? local.slice(0, local.length - 4) : local;
  const parts = namePart.split(".").filter(Boolean);
  if (parts.length === 0) return null;
  return parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

/** True when a notification of `type` already went to `email` within `windowMs`. */
export async function hasRecentNotification(
  email: string,
  type: string,
  windowMs: number
): Promise<boolean> {
  const since = new Date(Date.now() - windowMs);
  const count = await db.statusNotification.count({
    where: { email, type, createdAt: { gte: since } },
  });
  return count > 0;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function emptyStats(): DriveStats {
  return {
    total: 0,
    byDepartment: {},
    byDepartmentStatus: {},
    byJoinYear: {},
    last24h: 0,
    ...buildTimelines([]),
    generatedAt: new Date().toISOString(),
  };
}

function mapApplicationRow(row: Record<string, unknown>): ApplicationRecord {
  return {
    id: String(row.id ?? ""),
    email: String(row.email ?? ""),
    fullName: String(row.fullName ?? row.full_name ?? ""),
    joinYear: Number(row.joinYear ?? row.join_year ?? 0),
    yearOfStudy: Number(row.yearOfStudy ?? row.year_of_study ?? 0),
    department: String(row.department ?? ""),
    whatsapp: String(row.whatsapp ?? ""),
    answers: (row.answers ?? {}) as Record<string, string>,
    links: (row.links ?? { github: "", linkedin: "", portfolio: "" }) as Links,
    status: String(row.status ?? "SUBMITTED"),
    statusNote:
      row.statusNote === null || row.statusNote === undefined
        ? null
        : String(row.statusNote ?? ""),
    panelNote:
      row.panelNote === null ||
      row.panelNote === undefined ||
      row.panel_note === null ||
      row.panel_note === undefined
        ? null
        : String(row.panelNote ?? row.panel_note ?? ""),
    statusUpdatedAt: (() => {
      const raw = row.statusUpdatedAt ?? row.status_updated_at;
      if (!raw) return null;
      const d = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    reviewedBy:
      row.reviewedBy === null || row.reviewedBy === undefined
        ? null
        : String(row.reviewedBy ?? ""),
    interviewAt: (() => {
      const raw = row.interviewAt ?? row.interview_at;
      if (!raw) return null;
      const d = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    interviewMode:
      row.interviewMode === null || row.interviewMode === undefined
        ? null
        : String(row.interviewMode ?? ""),
    clarificationQuestion:
      row.clarificationQuestion === null || row.clarificationQuestion === undefined
        ? null
        : String(row.clarificationQuestion ?? ""),
    clarificationAnswer:
      row.clarificationAnswer === null || row.clarificationAnswer === undefined
        ? null
        : String(row.clarificationAnswer ?? ""),
    clarificationAskedAt: (() => {
      const raw = row.clarificationAskedAt ?? row.clarification_asked_at;
      if (!raw) return null;
      const d = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    clarificationAnsweredAt: (() => {
      const raw = row.clarificationAnsweredAt ?? row.clarification_answered_at;
      if (!raw) return null;
      const d = raw instanceof Date ? raw : new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    })(),
    statusHistory: parseStatusHistory(row.statusHistory ?? row.status_history),
    submittedAt: String(
      row.submittedAt ?? row.submitted_at ?? new Date().toISOString()
    ),
    updatedAt: String(row.updatedAt ?? row.updated_at ?? new Date().toISOString()),
  };
}

function mapNotificationRow(row: Record<string, unknown>): NotificationRecord {
  const dateOrNull = (raw: unknown): string | null => {
    if (!raw) return null;
    const d = raw instanceof Date ? raw : new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  };
  return {
    id: String(row.id ?? ""),
    applicationId: String(row.applicationId ?? row.application_id ?? ""),
    email: String(row.email ?? ""),
    fullName: String(row.fullName ?? row.full_name ?? ""),
    type: String(row.type ?? "STATUS_CHANGE"),
    subject: String(row.subject ?? ""),
    body: String(row.body ?? ""),
    channel: String(row.channel ?? "email"),
    status: String(row.status ?? "QUEUED"),
    lastError: row.lastError != null ? String(row.lastError) : row.last_error != null ? String(row.last_error) : null,
    createdAt: dateOrNull(row.createdAt ?? row.created_at) ?? new Date().toISOString(),
    sentAt: dateOrNull(row.sentAt ?? row.sent_at),
  };
}

function snakeToCamelRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k.replace(/_([a-z])/g, (_, c) => c.toUpperCase())] = v;
  }
  return out;
}
