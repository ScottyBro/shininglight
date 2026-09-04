-- =====================================================================
-- Shining Light — upgrade script for an EXISTING hosted Supabase project
-- that already has migrations 0001-0003 applied (i.e. the one running
-- shininglight-three.vercel.app today).
--
-- Adds: staff scheduling (shifts), developmental milestones + a seeded
-- library, classroom photo gallery (+ a per-child consent column), and
-- an SMS opt-in column on profiles.
--
-- Paste this whole file into Supabase Dashboard -> SQL Editor and Run —
-- ONCE. It is NOT safe to run twice: the CREATE TABLE / ALTER TABLE ADD
-- COLUMN statements will error ("already exists") on a second run, and the
-- milestones insert has no dedupe key (same as the existing fee_plans seed),
-- so it would duplicate rows even if the rest succeeded. If something fails
-- partway through, the whole script rolls back (it's wrapped in a single
-- transaction) — fix the reported error and run the full file again.
-- =====================================================================

begin;

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

-- Developmental milestones — a starter library across four domains and
-- rough early-childhood age bands (0–5y). Admins can add/edit/remove more
-- from Admin → Milestones.
-- ---------------------------------------------------------------------
insert into public.milestones (domain, title, description, min_age_months, max_age_months, sort_order)
values
  -- Motor
  ('motor', 'Sits without support', 'Sits upright unaided for a few minutes.', 4, 8, 1),
  ('motor', 'Walks independently', 'Takes several steps without holding on.', 9, 16, 2),
  ('motor', 'Climbs stairs with help', 'Goes up/down steps holding a rail or hand.', 14, 24, 3),
  ('motor', 'Runs and jumps', 'Runs with control and jumps with both feet.', 24, 36, 4),
  ('motor', 'Holds a pencil/crayon', 'Grips a crayon and makes marks with intent.', 24, 36, 5),
  ('motor', 'Pedals a tricycle', 'Pedals and steers a tricycle a short distance.', 30, 42, 6),
  ('motor', 'Hops on one foot', 'Balances and hops on one foot briefly.', 42, 54, 7),
  ('motor', 'Uses scissors', 'Cuts along a line with child-safe scissors.', 42, 60, 8),

  -- Cognitive
  ('cognitive', 'Object permanence', 'Looks for a toy that is hidden from view.', 6, 12, 1),
  ('cognitive', 'Sorts by shape/colour', 'Groups simple objects by one shared trait.', 18, 30, 2),
  ('cognitive', 'Counts to five', 'Recites and applies numbers one to five.', 30, 42, 3),
  ('cognitive', 'Recognises primary colours', 'Names red, blue and yellow correctly.', 30, 42, 4),
  ('cognitive', 'Completes simple puzzles', 'Finishes a 4–6 piece puzzle unaided.', 30, 48, 5),
  ('cognitive', 'Understands time concepts', 'Uses words like "today", "tomorrow", "later".', 42, 60, 6),
  ('cognitive', 'Recognises own name in print', 'Points to or reads their written first name.', 42, 60, 7),

  -- Language
  ('language', 'Says first words', 'Uses a few clear, meaningful single words.', 10, 18, 1),
  ('language', 'Combines two words', 'Puts two words together, e.g. "more milk".', 16, 24, 2),
  ('language', 'Follows two-step instructions', 'Carries out a simple two-part request.', 24, 36, 3),
  ('language', 'Speaks in short sentences', 'Uses 3–4 word sentences most people understand.', 30, 42, 4),
  ('language', 'Tells a simple story', 'Recounts a recent event in the right order.', 42, 54, 5),
  ('language', 'Asks "why" and "how" questions', 'Uses questions to explore cause and effect.', 36, 48, 6),

  -- Social / emotional
  ('social', 'Social smiling', 'Smiles in response to a familiar face.', 1, 4, 1),
  ('social', 'Plays alongside other children', 'Parallel play near peers without much interaction.', 18, 30, 2),
  ('social', 'Takes turns with support', 'Shares or takes turns when prompted by an adult.', 30, 42, 3),
  ('social', 'Shows empathy', 'Notices and responds to another child''s distress.', 30, 48, 4),
  ('social', 'Cooperative play', 'Plays with shared rules/goals alongside peers.', 42, 60, 5),
  ('social', 'Manages simple transitions', 'Moves between activities with minimal upset.', 24, 48, 6)
on conflict do nothing;

commit;
