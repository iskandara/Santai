-- SANTAI CMS security: who may read and write the database and the image bucket.
--
-- Before this runs, the CMS was open: the anon key that ships in index.html could
-- insert, update and delete rows and files. After it runs, everyone can still READ
-- (the site needs that), and only ONE signed-in account can write.
--
-- Steps, in the Supabase dashboard:
--   1. Authentication > Users > Add user. Use your email and a long, unique password.
--      Tick "Auto Confirm User".
--   2. Authentication > Sign In / Providers: turn OFF "Allow new users to sign up"
--      and turn OFF "Allow anonymous sign-ins". Otherwise anyone could make an account.
--   3. Change REPLACE_WITH_EDITOR_EMAIL below to the email from step 1.
--   4. SQL Editor > paste this whole file > Run. It is safe to run again.
--   5. Open yoursite/#CMSedit and sign in with that email and password.
--
-- If you skip step 3 nobody can write, which fails safe: the site still shows, you
-- just cannot edit until you set the email and run the file again.
--
-- Table names: santai_global, santai_articles. Bucket: santai-assets.

-- The one account allowed to edit. Change the email in this function and nowhere else.
create or replace function public.santai_is_editor()
returns boolean
language sql
stable
as $$
  select coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and coalesce(auth.jwt() ->> 'email', '') = 'REPLACE_WITH_EDITOR_EMAIL'
$$;

-- ── Tables ──────────────────────────────────────────────────────────
alter table public.santai_global   enable row level security;
alter table public.santai_articles enable row level security;

-- Drop whatever policies exist today (including any "allow anon to write" ones), then start clean.
do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('santai_global', 'santai_articles')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

create policy santai_global_read   on public.santai_global   for select to anon, authenticated using (true);
create policy santai_articles_read on public.santai_articles for select to anon, authenticated using (true);

create policy santai_global_insert on public.santai_global for insert to authenticated with check (public.santai_is_editor());
create policy santai_global_update on public.santai_global for update to authenticated using (public.santai_is_editor()) with check (public.santai_is_editor());
create policy santai_global_delete on public.santai_global for delete to authenticated using (public.santai_is_editor());

create policy santai_articles_insert on public.santai_articles for insert to authenticated with check (public.santai_is_editor());
create policy santai_articles_update on public.santai_articles for update to authenticated using (public.santai_is_editor()) with check (public.santai_is_editor());
create policy santai_articles_delete on public.santai_articles for delete to authenticated using (public.santai_is_editor());

-- Second lock: the anon role cannot write even if a policy were added by mistake later.
revoke insert, update, delete, truncate on table public.santai_global   from anon;
revoke insert, update, delete, truncate on table public.santai_articles from anon;

-- ── Image and audio bucket ──────────────────────────────────────────
-- Public bucket: files are readable by URL, which is what the site uses.
-- Only images and audio, 10 MB at most.
update storage.buckets
set public = true,
    file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/ogg','audio/mp4','audio/wav']
where id = 'santai-assets';

-- Drop existing policies that touch this bucket (other buckets are left alone), then add the editor-only ones.
do $$
declare r record;
begin
  for r in
    select policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') like '%santai-assets%' or coalesce(with_check, '') like '%santai-assets%')
  loop
    execute format('drop policy %I on storage.objects', r.policyname);
  end loop;
end $$;

-- Public URLs work without any policy. The editor gets a SELECT policy too, because an upload
-- reads its own row back. Anonymous visitors get none, so nobody else can list the bucket.
create policy santai_assets_select on storage.objects for select to authenticated
  using (bucket_id = 'santai-assets' and public.santai_is_editor());
create policy santai_assets_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'santai-assets' and public.santai_is_editor());
create policy santai_assets_update on storage.objects for update to authenticated
  using (bucket_id = 'santai-assets' and public.santai_is_editor())
  with check (bucket_id = 'santai-assets' and public.santai_is_editor());
create policy santai_assets_delete on storage.objects for delete to authenticated
  using (bucket_id = 'santai-assets' and public.santai_is_editor());

-- ── Check the result ────────────────────────────────────────────────
-- Run this on its own afterwards. For storage.objects you should see only policies that
-- mention santai-assets and are limited to the editor, plus policies for other buckets you use.
-- Any policy that allows `anon` or all of `authenticated` to write to storage.objects is still open.
--   select policyname, cmd, roles, qual, with_check
--   from pg_policies where schemaname in ('public','storage') order by tablename, policyname;
