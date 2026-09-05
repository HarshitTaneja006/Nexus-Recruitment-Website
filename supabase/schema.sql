-- ============================================================
-- NEXUS Recruitments - Supabase schema (Production Ready)
-- Run this once in the Supabase SQL editor, then set env vars:
--   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
-- When configured, the app persists applications & drafts here
-- instead of the local Prisma/SQLite database.
-- ============================================================

-- 1. Applications Table
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       text not null unique,
  email         text not null unique,
  full_name     text not null,
  join_year     int  not null,
  year_of_study int  not null,
  department    text not null,
  whatsapp      text not null default '',
  answers       jsonb not null default '{}'::jsonb,
  links         jsonb not null default '{}'::jsonb,
  status        text not null default 'SUBMITTED',
  status_note   text,
  panel_note    text,
  status_updated_at timestamptz,
  reviewed_by   text,
  interview_at  timestamptz,
  interview_mode text,
  status_history jsonb not null default '[]'::jsonb,
  clarification_question text,
  clarification_answer text,
  clarification_asked_at timestamptz,
  clarification_answered_at timestamptz,
  submitted_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Migration helpers for pre-existing deployments (safe to re-run anytime)
alter table public.applications add column if not exists whatsapp text not null default '';
alter table public.applications add column if not exists status_note text;
alter table public.applications add column if not exists panel_note text;
alter table public.applications add column if not exists status_updated_at timestamptz;
alter table public.applications add column if not exists reviewed_by text;
alter table public.applications add column if not exists interview_at timestamptz;
alter table public.applications add column if not exists interview_mode text;
alter table public.applications add column if not exists status_history jsonb not null default '[]'::jsonb;
alter table public.applications add column if not exists clarification_question text;
alter table public.applications add column if not exists clarification_answer text;
alter table public.applications add column if not exists clarification_asked_at timestamptz;
alter table public.applications add column if not exists clarification_answered_at timestamptz;

-- Performance Indexes
create index if not exists applications_department_idx on public.applications (department);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_submitted_at_idx on public.applications (submitted_at desc);
create index if not exists applications_interview_at_idx on public.applications (interview_at) where status = 'INTERVIEW';


-- 2. Notification Outbox Table
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
  last_error     text,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz
);

-- Migration helpers for notification outbox
alter table public.status_notifications add column if not exists last_error text;

-- Notification Indexes
create index if not exists status_notifications_status_idx on public.status_notifications (status);
create index if not exists status_notifications_created_idx on public.status_notifications (created_at desc);


-- 3. Application Drafts Table
create table if not exists public.application_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null unique,
  email      text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create index if not exists application_drafts_email_idx on public.application_drafts (email);


-- 4. Row Level Security (RLS)
-- Protect against unauthenticated REST queries via the public anon key.
-- Server-side Next.js route handlers use the service_role key to bypass RLS safely.
alter table public.applications enable row level security;
alter table public.status_notifications enable row level security;
alter table public.application_drafts enable row level security;


-- 5. Atomic Upsert Stored Procedure
-- Handles race-free submission / resubmission from the Next.js API
create or replace function public.submit_application(
  p_user_id text,
  p_email text,
  p_full_name text,
  p_join_year int,
  p_year_of_study int,
  p_department text,
  p_whatsapp text default '',
  p_answers jsonb default '{}'::jsonb,
  p_links jsonb default '{}'::jsonb
) returns setof public.applications
language sql
security definer
set search_path = public
as $$
  insert into public.applications
    (user_id, email, full_name, join_year, year_of_study, department, whatsapp, answers, links)
  values
    (p_user_id, p_email, p_full_name, p_join_year, p_year_of_study, p_department, coalesce(p_whatsapp, ''), coalesce(p_answers, '{}'::jsonb), coalesce(p_links, '{}'::jsonb))
  on conflict (email) do update set
    user_id       = excluded.user_id,
    full_name     = excluded.full_name,
    join_year     = excluded.join_year,
    year_of_study = excluded.year_of_study,
    department    = excluded.department,
    whatsapp      = excluded.whatsapp,
    answers       = excluded.answers,
    links         = excluded.links,
    updated_at    = now()
  returning *;
$$;
