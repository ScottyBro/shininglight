-- =====================================================================
-- Migration 0004: Staff scheduling, developmental milestones, classroom
-- photo gallery, and SMS opt-in — additive, does not touch existing tables
-- beyond two new nullable/defaulted columns.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Staff scheduling
-- ---------------------------------------------------------------------
create table public.shifts (
  id           uuid primary key default gen_random_uuid(),
  teacher_id   uuid not null references public.profiles(id) on delete cascade,
  classroom_id uuid references public.classrooms(id) on delete set null,
  date         date not null,
  start_time   time not null,
  end_time     time not null,
  notes        text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  check (end_time > start_time)
);
create index shifts_teacher_date_idx on public.shifts(teacher_id, date);
create index shifts_date_idx on public.shifts(date);

-- ---------------------------------------------------------------------
-- Developmental milestones
-- ---------------------------------------------------------------------
create type milestone_domain as enum ('motor', 'cognitive', 'language', 'social');
create type milestone_status as enum ('not_started', 'in_progress', 'achieved');

create table public.milestones (
  id             uuid primary key default gen_random_uuid(),
  domain         milestone_domain not null,
  title          text not null,
  description    text,
  min_age_months int not null check (min_age_months >= 0),
  max_age_months int not null check (max_age_months >= min_age_months),
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);
create index milestones_domain_idx on public.milestones(domain, sort_order);

create table public.child_milestones (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.children(id) on delete cascade,
  milestone_id uuid not null references public.milestones(id) on delete cascade,
  status       milestone_status not null default 'not_started',
  notes        text,
  achieved_at  timestamptz,
  recorded_by  uuid references public.profiles(id) on delete set null,
  updated_at   timestamptz not null default now(),
  unique (child_id, milestone_id)
);
create index child_milestones_child_idx on public.child_milestones(child_id);

-- ---------------------------------------------------------------------
-- Classroom photo gallery
-- ---------------------------------------------------------------------
-- Per-child policy signal, not a technical per-photo filter: the app has no
-- face-tagging, so this tells staff which children should be kept out of
-- frame in shared classroom photos, rather than blocking the album itself.
alter table public.children
  add column gallery_consent boolean not null default false;

create table public.gallery_photos (
  id           uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms(id) on delete cascade,
  path         text not null,
  caption      text,
  uploaded_by  uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index gallery_photos_classroom_idx on public.gallery_photos(classroom_id, created_at);

-- ---------------------------------------------------------------------
-- SMS opt-in (parents without reliable app/data access)
-- ---------------------------------------------------------------------
alter table public.profiles
  add column sms_opt_in boolean not null default false;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.shifts           enable row level security;
alter table public.milestones       enable row level security;
alter table public.child_milestones enable row level security;
alter table public.gallery_photos   enable row level security;

-- Shifts: teachers see/manage their own; admin sees/manages all.
create policy shifts_select on public.shifts
  for select to authenticated
  using (public.is_admin() or teacher_id = auth.uid());

create policy shifts_admin_write on public.shifts
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Milestones library: readable by any authenticated user, curated by admins.
create policy milestones_select on public.milestones
  for select to authenticated using (true);

create policy milestones_admin_write on public.milestones
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Child milestones: teachers record progress for children they teach;
-- parents get read-only visibility into their own child's progress.
create policy child_milestones_select on public.child_milestones
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches_child(child_id)
    or public.is_parent_of(child_id)
  );

create policy child_milestones_teacher_write on public.child_milestones
  for all to authenticated
  using (public.is_admin() or public.teaches_child(child_id))
  with check (public.is_admin() or public.teaches_child(child_id));

-- Gallery: a parent may see an album if any of their linked children are in
-- that classroom. Teachers manage the classroom(s) they lead.
create or replace function public.parent_has_child_in_classroom(room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.parent_children pc
    join public.children c on c.id = pc.child_id
    where pc.parent_id = auth.uid() and c.classroom_id = room
  );
$$;

create or replace function public.teaches_classroom(room uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.classrooms cr
    where cr.id = room and cr.teacher_id = auth.uid()
  );
$$;

create policy gallery_photos_select on public.gallery_photos
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches_classroom(classroom_id)
    or public.parent_has_child_in_classroom(classroom_id)
  );

create policy gallery_photos_teacher_write on public.gallery_photos
  for all to authenticated
  using (public.is_admin() or public.teaches_classroom(classroom_id))
  with check (public.is_admin() or public.teaches_classroom(classroom_id));

-- ---------------------------------------------------------------------
-- Storage: gallery photos bucket
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('gallery-photos', 'gallery-photos', false)
on conflict (id) do nothing;

create policy "authenticated read gallery media"
  on storage.objects for select to authenticated
  using (bucket_id = 'gallery-photos');

create policy "authenticated write gallery media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery-photos');

create policy "authenticated delete gallery media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'gallery-photos');

-- ---------------------------------------------------------------------
-- Grants (mirrors migration 0002 — RLS still governs row visibility)
-- ---------------------------------------------------------------------
grant select, insert, update, delete on public.shifts, public.milestones, public.child_milestones, public.gallery_photos to authenticated;
