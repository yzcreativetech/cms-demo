-- =========================================================
-- VCA PHILIPPINES CMS DEMO
-- STEP 6 - ADMIN RLS + STORAGE SECURITY
-- =========================================================

-- Documents the approved setup; this file has not been executed by this task.
-- Replace YOUR-ADMIN-UUID with the manually created CMS admin user's
-- Supabase Auth UUID before executing this file in a new environment.
-- Run this file on a fresh schema/security setup or remove existing policies
-- before reapplying. CREATE POLICY fails if the policy already exists.
-- Apply after schema.sql: Step 4 enables RLS and creates public SELECT
-- policies. Those policies are retained and are not duplicated here.


-- ---------------------------------------------------------
-- 1. DATABASE ROLE GRANTS
-- ---------------------------------------------------------

-- Homepage INSERT and DELETE are intentionally unavailable.
revoke all on table public.homepage_content
from anon, authenticated;

grant select
on table public.homepage_content
to anon, authenticated;

grant update
on table public.homepage_content
to authenticated;


revoke all on table public.homepage_announcements
from anon, authenticated;

grant select
on table public.homepage_announcements
to anon, authenticated;

grant insert, update, delete
on table public.homepage_announcements
to authenticated;

grant usage, select
on sequence public.homepage_announcements_id_seq
to authenticated;


-- ---------------------------------------------------------
-- 2. HOMEPAGE CONTENT ADMIN UPDATE POLICY
-- ---------------------------------------------------------

create policy "Approved admin can update homepage content"
on public.homepage_content
for update
to authenticated
using (
    (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and id = 1
)
with check (
    (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and id = 1
);


-- ---------------------------------------------------------
-- 3. ANNOUNCEMENT ADMIN POLICIES
-- ---------------------------------------------------------

create policy "Approved admin can insert homepage announcements"
on public.homepage_announcements
for insert
to authenticated
with check (
    (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and homepage_id = 1
);

create policy "Approved admin can update homepage announcements"
on public.homepage_announcements
for update
to authenticated
using (
    (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and homepage_id = 1
)
with check (
    (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and homepage_id = 1
);

create policy "Approved admin can delete homepage announcements"
on public.homepage_announcements
for delete
to authenticated
using (
    (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and homepage_id = 1
);


-- ---------------------------------------------------------
-- 4. STORAGE BUCKET CONFIGURATION AND UPLOAD POLICY
-- ---------------------------------------------------------

-- Create/configure the cms-demo bucket through the Supabase dashboard:
--   Public bucket: enabled
--   File size limit: 5 MB
--   Allowed MIME types: image/png, image/jpeg, image/webp
-- Public image reads work because the bucket is public, including logged-out
-- requests to public image URLs; no additional SELECT policy is added here.
-- Storage UPDATE and DELETE policies are intentionally absent.
-- The CMS upload strategy uses new unique filenames rather than overwriting
-- existing objects. Only the approved top-level folders may receive uploads.

create policy "Approved admin can upload CMS images"
on storage.objects
for insert
to authenticated
with check (
    bucket_id = 'cms-demo'
    and (select auth.uid()) = 'YOUR-ADMIN-UUID'::uuid
    and (storage.foldername(name))[1] in (
        'logos',
        'hero',
        'movement'
    )
);
