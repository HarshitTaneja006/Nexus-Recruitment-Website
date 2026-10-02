-- ============================================================
-- NEXUS Recruitments '26 - acceptance certificates bucket
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
