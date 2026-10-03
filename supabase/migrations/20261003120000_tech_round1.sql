-- ============================================================
-- Tech Round 1 shortlist (technical department two-stage shortlist)
--   SHORTLISTED_R1 -> project round (no interview slot, deadline +
--     github / report / deploy submission stored on the row)
--   SHORTLISTED_R2 -> interview round (slot behaves like SHORTLISTED)
--
-- ============================================================

-- 1. Round 1 submission columns on public.applications
alter table public.applications
  add column if not exists round1_github_url text;
alter table public.applications
  add column if not exists round1_report_url text;
alter table public.applications
  add column if not exists round1_deploy_url text;
alter table public.applications
  add column if not exists round1_submitted_at timestamptz;

-- 2. Fast lookup of tech Round 1 cohorts + submitted work
create index if not exists applications_round1_status_idx
  on public.applications (status) where status = 'SHORTLISTED_R1';
create index if not exists applications_round1_submitted_idx
  on public.applications (round1_submitted_at)
  where status = 'SHORTLISTED_R1';

-- 3. Fresh installs: supabase/schema.sql already contains these columns
-- in the CREATE TABLE block; this migration only backfills deployments
-- created before this change. No RLS change needed (service_role
-- bypasses RLS; anon has no policies on this table, as before).

-- 4. Round 1 deadline is NOT a column - it is a runtime Setting row
-- (key = 'tech_round1_deadline', value = ISO timestamp) managed via
-- the review console / PATCH /api/admin/tech-round1-deadline.
-- Nothing to create here; the Setting KV table is Prisma-managed.
