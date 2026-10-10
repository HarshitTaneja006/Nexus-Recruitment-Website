-- ============================================================
-- NEXUS Recruitments '26 - acceptance certificates bucket
-- Run this YOURSELF in the Supabase SQL editor (or via the Supabase
-- CLI). The app never creates buckets at runtime - the drain only
-- READS from this bucket with the service_role key.
--
--   1. Open Supabase Dashboard → your project → SQL Editor → New query
--   2. Paste this whole file → Run
--   3. Verify: Storage → Buckets → `certificates` exists, Public = OFF
--   4. Upload PNGs: Storage → certificates → Upload, one file per
--      accepted student named exactly:
--        <whatsapp-number>.png
--        e.g. 9876543210.png (10-digit number on the application)
--      Upload any time BEFORE flushing the acceptance mail from the
--      outbox - the drain attaches the PNG at send time and refuses
--      (CERT_MISSING) while the file is absent.
--
-- CLI alternative (from repo root, logged in with `supabase login`):
--   supabase db push --file supabase/migrations/20261002_create_certificates_bucket.sql
-- Nothing in this file is destructive - safe to re-run.
-- ============================================================

-- 1. Private bucket (service_role bypasses RLS, so server reads work
--    with zero object policies; anon/authenticated get nothing).
insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false)
on conflict (id) do nothing;

-- 2. Belt-and-braces: keep the bucket private even if re-run after a
--    manual toggle in the dashboard.
update storage.buckets
set public = false
where id = 'certificates';

-- 3. (Optional, commented) If you ever need core-team browsers to
--    preview PNGs via the anon key, create a separate READ-ONLY policy.
--    Default is deny-all for anon/authenticated, which is what we want:
--    certificates are PII-adjacent and leave only inside the email.
--    Uncomment only if you understand the exposure:
--
-- create policy "core preview certificates"
-- on storage.objects for select
-- to authenticated
-- using (bucket_id = 'certificates');
