-- ============================================================
-- Tech Round 1: problem-statement choice ("01".."04")
-- Students pick one statement on their Round 1 screen; it is stored
-- on the row next to the github / report / deploy hand-in.
-- 2nd/3rd-year students are limited to "03"/"04" (enforced in the
-- API + UI, not by a DB CHECK, so core can relax it without SQL).
--
-- HOW TO APPLY: `supabase db push`, or paste this file into the
-- Supabase Dashboard -> SQL Editor -> Run. Safe to re-run.
-- Then `npx prisma db push` + `npx prisma generate` for the client.
-- ============================================================

alter table public.applications
  add column if not exists round1_problem_statement text;

create index if not exists applications_round1_statement_idx
  on public.applications (round1_problem_statement)
  where status = 'SHORTLISTED_R1';
