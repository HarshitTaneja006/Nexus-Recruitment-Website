-- ============================================================
-- NEXUS Recruitments — Supabase schema
-- Run this once in the Supabase SQL editor, then set env vars:
--   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
-- When configured, the app persists applications & drafts here
-- instead of the local Prisma/SQLite database.
-- ============================================================

create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null unique,
  email         text not null unique,
  full_name     text not null,
  join_year     int  not null,
  year_of_study int  not null,
  department    text not null,
  answers       jsonb not null default '{}'::jsonb,
  links         jsonb not null default '{}'::jsonb,
  status        text not null default 'SUBMITTED',
  status_note   text,
  status_updated_at timestamptz,
  reviewed_by   text,
  interview_at  timestamptz,
  interview_mode text,
  status_history jsonb not null default '[]'::jsonb,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists applications_department_idx on public.applications (department);
create index if not exists applications_status_idx on public.applications (status);

-- Migration helper for pre-existing deployments (safe to re-run)
alter table public.applications add column if not exists status_note text;
alter table public.applications add column if not exists status_updated_at timestamptz;
alter table public.applications add column if not exists reviewed_by text;
alter table public.applications add column if not exists interview_at timestamptz;
alter table public.applications add column if not exists interview_mode text;
alter table public.applications add column if not exists status_history jsonb not null default '[]'::jsonb;

-- Clarification loop (status = NEEDS_INFO): admin asks → student answers
alter table public.applications add column if not exists clarification_question text;
alter table public.applications add column if not exists clarification_answer text;
alter table public.applications add column if not exists clarification_asked_at timestamptz;
alter table public.applications add column if not exists clarification_answered_at timestamptz;

-- Notification outbox — the admin PATCH route queues rows here; a worker
-- (Resend / Supabase Edge Function / pg_cron) drains the queue in production.
create table if not exists public.status_notifications (
  id             uuid primary key default gen_random_uuid(),
  application_id text not null,
  email          text not null,
  full_name      text not null,
  type           text not null default 'STATUS_CHANGE',
  subject        text not null,
  body           text not null,
  channel        text not null default 'email',
  status         text not null default 'QUEUED',
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

create index if not exists status_notifications_status_idx on public.status_notifications (status);
create index if not exists status_notifications_created_idx on public.status_notifications (created_at desc);

create table if not exists public.application_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null unique,
  email      text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Atomic upsert used by the app (service role bypasses RLS anyway,
-- this function keeps the write race-free).
create or replace function public.submit_application(
  p_user_id text,
  p_email text,
  p_full_name text,
  p_join_year int,
  p_year_of_study int,
  p_department text,
  p_answers jsonb,
  p_links jsonb
) returns setof public.applications
language sql
as $$
  insert into public.applications
    (user_id, email, full_name, join_year, year_of_study, department, answers, links)
  values
    (p_user_id, p_email, p_full_name, p_join_year, p_year_of_study, p_department, p_answers, p_links)
  on conflict (email) do update set
    user_id       = excluded.user_id,
    full_name     = excluded.full_name,
    join_year     = excluded.join_year,
    year_of_study = excluded.year_of_study,
    department    = excluded.department,
    answers       = excluded.answers,
    links         = excluded.links,
    updated_at    = now()
  returning *;
$$;
