-- =====================================================================
-- Migration 0003: Storage buckets for photos (private) + policies
-- Buckets are private; the app serves images via short-lived signed URLs.
-- =====================================================================

insert into storage.buckets (id, name, public)
values
  ('child-photos',  'child-photos',  false),
  ('report-photos', 'report-photos', false),
  ('pickup-photos', 'pickup-photos', false)
on conflict (id) do nothing;

-- Any authenticated staff/parent may read these images (the app narrows what
-- is actually surfaced per role). Signed URLs are minted server-side.
create policy "authenticated read child media"
  on storage.objects for select to authenticated
  using (bucket_id in ('child-photos', 'report-photos', 'pickup-photos'));

-- Authenticated users may upload/update/remove media. Higher-level role
-- rules (who may enroll a child vs. attach a report photo) are enforced in
-- the application layer / server actions.
create policy "authenticated write child media"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('child-photos', 'report-photos', 'pickup-photos'));

create policy "authenticated update child media"
  on storage.objects for update to authenticated
  using (bucket_id in ('child-photos', 'report-photos', 'pickup-photos'))
  with check (bucket_id in ('child-photos', 'report-photos', 'pickup-photos'));

create policy "authenticated delete child media"
  on storage.objects for delete to authenticated
  using (bucket_id in ('child-photos', 'report-photos', 'pickup-photos'));
