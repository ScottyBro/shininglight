-- =====================================================================
-- Shining Light — one-shot setup bundle for a HOSTED Supabase project.
-- Paste this whole file into the Supabase Dashboard -> SQL Editor and Run.
-- It is migrations 0001..0004 followed by the seed, in order.
-- Safe to run once on a fresh project. (For repeatable local dev use the
-- individual files under supabase/migrations via the Supabase CLI.)
-- =====================================================================

begin;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: supabase/migrations/0001_schema.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =====================================================================
-- Shining Light Pre-School — core schema
-- Migration 0001: extensions, enums, tables, indexes, views, triggers
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type user_role as enum ('admin', 'teacher', 'parent');
create type enrollment_status as enum ('active', 'waitlisted', 'withdrawn');
create type report_status as enum ('draft', 'published');
create type billing_cycle as enum ('monthly', 'termly', 'annual');
create type invoice_status as enum ('unpaid', 'partial', 'paid', 'overdue');
create type payment_method as enum ('cash', 'ecocash', 'bank_transfer', 'other');

-- ---------------------------------------------------------------------
-- profiles  (1:1 with auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users(id) on delete cascade,
  role               user_role not null default 'parent',
  full_name          text,
  phone              text,
  preferred_language text default 'en',
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- classrooms
-- ---------------------------------------------------------------------
create table public.classrooms (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  max_capacity int not null default 20 check (max_capacity > 0),
  teacher_id   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- children
-- ---------------------------------------------------------------------
create table public.children (
  id                 uuid primary key default gen_random_uuid(),
  full_name          text not null,
  date_of_birth      date,
  photo_url          text,
  allergies          text[] not null default '{}',
  medical_notes      text,
  emergency_contacts jsonb not null default '[]'::jsonb,
  authorized_pickups jsonb not null default '[]'::jsonb,
  classroom_id       uuid references public.classrooms(id) on delete set null,
  enrollment_status  enrollment_status not null default 'active',
  enrolled_at        timestamptz default now(),
  created_at         timestamptz not null default now()
);
create index children_classroom_idx on public.children(classroom_id);

-- ---------------------------------------------------------------------
-- parent_children  (many-to-many parents <-> children)
-- ---------------------------------------------------------------------
create table public.parent_children (
  parent_id    uuid not null references public.profiles(id) on delete cascade,
  child_id     uuid not null references public.children(id) on delete cascade,
  relationship text,
  primary key (parent_id, child_id)
);
create index parent_children_child_idx on public.parent_children(child_id);

-- ---------------------------------------------------------------------
-- attendance
-- ---------------------------------------------------------------------
create table public.attendance (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.children(id) on delete cascade,
  date          date not null default current_date,
  check_in_at   timestamptz,
  check_out_at  timestamptz,
  check_in_by   uuid references public.profiles(id) on delete set null,
  check_out_by  uuid references public.profiles(id) on delete set null,
  unique (child_id, date)
);
create index attendance_date_idx on public.attendance(date);
create index attendance_child_idx on public.attendance(child_id);

-- ---------------------------------------------------------------------
-- daily_reports
-- ---------------------------------------------------------------------
create table public.daily_reports (
  id            uuid primary key default gen_random_uuid(),
  child_id      uuid not null references public.children(id) on delete cascade,
  date          date not null default current_date,
  meals         jsonb not null default '[]'::jsonb,
  naps          jsonb not null default '[]'::jsonb,
  bathroom      jsonb not null default '[]'::jsonb,
  mood          text,
  activities    text,
  notes         text,
  photos        text[] not null default '{}',
  status        report_status not null default 'draft',
  ai_generated  boolean not null default false,
  created_by    uuid references public.profiles(id) on delete set null,
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (child_id, date)
);
create index daily_reports_child_idx on public.daily_reports(child_id);
create index daily_reports_status_idx on public.daily_reports(status);

-- ---------------------------------------------------------------------
-- messages  (per-child teacher <-> parent thread)
-- ---------------------------------------------------------------------
create table public.messages (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references public.children(id) on delete cascade,
  sender_id  uuid not null references public.profiles(id) on delete cascade,
  body       text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at    timestamptz
);
create index messages_child_idx on public.messages(child_id, created_at);

-- ---------------------------------------------------------------------
-- Billing: fee_plans, invoices, payments
-- ---------------------------------------------------------------------
create table public.fee_plans (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  amount        numeric(12,2) not null check (amount >= 0),
  billing_cycle billing_cycle not null,
  description   text,
  created_at    timestamptz not null default now()
);

create table public.invoices (
  id           uuid primary key default gen_random_uuid(),
  child_id     uuid not null references public.children(id) on delete cascade,
  fee_plan_id  uuid references public.fee_plans(id) on delete set null,
  period_label text not null,
  amount_due   numeric(12,2) not null check (amount_due >= 0),
  due_date     date not null,
  status       invoice_status not null default 'unpaid',
  issued_at    timestamptz not null default now()
);
create index invoices_child_idx on public.invoices(child_id);
create index invoices_status_idx on public.invoices(status);

-- Human-friendly receipt numbers: RCP-000001, RCP-000002, ...
create sequence if not exists public.receipt_number_seq;

create table public.payments (
  id             uuid primary key default gen_random_uuid(),
  invoice_id     uuid references public.invoices(id) on delete set null,
  child_id       uuid not null references public.children(id) on delete cascade,
  amount         numeric(12,2) not null check (amount > 0),
  method         payment_method not null default 'cash',
  receipt_number text not null unique
                   default 'RCP-' || lpad(nextval('public.receipt_number_seq')::text, 6, '0'),
  paid_at        timestamptz not null default now(),
  recorded_by    uuid references public.profiles(id) on delete set null
);
create index payments_invoice_idx on public.payments(invoice_id);
create index payments_child_idx on public.payments(child_id);

-- ---------------------------------------------------------------------
-- Derived balance per child (invoices - payments)
-- ---------------------------------------------------------------------
create view public.child_balances
with (security_invoker = true) as
select
  c.id as child_id,
  coalesce((select sum(i.amount_due) from public.invoices i where i.child_id = c.id), 0)::numeric(12,2) as total_invoiced,
  coalesce((select sum(p.amount)     from public.payments p where p.child_id = c.id), 0)::numeric(12,2) as total_paid,
  (
    coalesce((select sum(i.amount_due) from public.invoices i where i.child_id = c.id), 0)
    - coalesce((select sum(p.amount)   from public.payments p where p.child_id = c.id), 0)
  )::numeric(12,2) as balance
from public.children c;

-- ---------------------------------------------------------------------
-- Auto-create a profile row whenever an auth user is created.
-- Role + name come from the sign-up metadata (defaults to 'parent').
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name, phone)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'parent'),
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'phone'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: supabase/migrations/0002_rls.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =====================================================================
-- Migration 0002: Row-Level Security
-- Helper functions (SECURITY DEFINER to avoid recursive RLS) + policies
-- for every table. Fail-closed by default.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Authorization helper functions
-- SECURITY DEFINER so they can read profiles/parent_children/classrooms
-- without being blocked by (or recursing into) those tables' own RLS.
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.is_parent_of(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.parent_children
    where parent_id = auth.uid() and child_id = child
  );
$$;

create or replace function public.teaches_child(child uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.children c
    join public.classrooms cr on cr.id = c.classroom_id
    where c.id = child and cr.teacher_id = auth.uid()
  );
$$;

-- True when the current user (a teacher) teaches a child linked to `other`
-- (a parent). Lets staff see the names/contacts of parents in their room.
create or replace function public.shares_child_with(other uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.parent_children pc
    join public.children c  on c.id  = pc.child_id
    join public.classrooms cr on cr.id = c.classroom_id
    where pc.parent_id = other and cr.teacher_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------
-- Prevent privilege escalation: only admins may change a profile's role.
-- ---------------------------------------------------------------------
create or replace function public.enforce_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Only admins may change a user role';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.enforce_role_change();

-- ---------------------------------------------------------------------
-- Enable RLS on every table
-- ---------------------------------------------------------------------
alter table public.profiles        enable row level security;
alter table public.classrooms      enable row level security;
alter table public.children        enable row level security;
alter table public.parent_children enable row level security;
alter table public.attendance      enable row level security;
alter table public.daily_reports   enable row level security;
alter table public.messages        enable row level security;
alter table public.fee_plans       enable row level security;
alter table public.invoices        enable row level security;
alter table public.payments        enable row level security;

-- =====================================================================
-- profiles
-- =====================================================================
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or public.is_admin()
    or role = 'teacher'                 -- staff names visible to families
    or public.shares_child_with(id)     -- teacher <-> that room's parents
  );

create policy profiles_self_update on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());         -- role change blocked by trigger

create policy profiles_admin_all on public.profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- classrooms  (names are not sensitive; writes are admin-only)
-- =====================================================================
create policy classrooms_select on public.classrooms
  for select to authenticated using (true);

create policy classrooms_admin_write on public.classrooms
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- children
-- =====================================================================
create policy children_select on public.children
  for select to authenticated
  using (
    public.is_admin()
    or public.is_parent_of(id)
    or public.teaches_child(id)
  );

create policy children_teacher_insert on public.children
  for insert to authenticated
  with check (
    public.is_admin()
    or exists (
      select 1 from public.classrooms cr
      where cr.id = classroom_id and cr.teacher_id = auth.uid()
    )
  );

create policy children_teacher_update on public.children
  for update to authenticated
  using (public.is_admin() or public.teaches_child(id))
  with check (
    public.is_admin()
    or public.teaches_child(id)
    or exists (
      select 1 from public.classrooms cr
      where cr.id = classroom_id and cr.teacher_id = auth.uid()
    )
  );

create policy children_admin_delete on public.children
  for delete to authenticated using (public.is_admin());

-- =====================================================================
-- parent_children  (linking is an admin task)
-- =====================================================================
create policy parent_children_select on public.parent_children
  for select to authenticated
  using (
    public.is_admin()
    or parent_id = auth.uid()
    or public.teaches_child(child_id)
  );

create policy parent_children_admin_write on public.parent_children
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- =====================================================================
-- attendance
-- =====================================================================
create policy attendance_select on public.attendance
  for select to authenticated
  using (
    public.is_admin()
    or public.is_parent_of(child_id)
    or public.teaches_child(child_id)
  );

create policy attendance_teacher_insert on public.attendance
  for insert to authenticated
  with check (public.is_admin() or public.teaches_child(child_id));

create policy attendance_teacher_update on public.attendance
  for update to authenticated
  using (public.is_admin() or public.teaches_child(child_id))
  with check (public.is_admin() or public.teaches_child(child_id));

create policy attendance_admin_delete on public.attendance
  for delete to authenticated using (public.is_admin());

-- =====================================================================
-- daily_reports  (parents see PUBLISHED only)
-- =====================================================================
create policy daily_reports_select on public.daily_reports
  for select to authenticated
  using (
    public.is_admin()
    or public.teaches_child(child_id)
    or (public.is_parent_of(child_id) and status = 'published')
  );

create policy daily_reports_teacher_insert on public.daily_reports
  for insert to authenticated
  with check (public.is_admin() or public.teaches_child(child_id));

create policy daily_reports_teacher_update on public.daily_reports
  for update to authenticated
  using (public.is_admin() or public.teaches_child(child_id))
  with check (public.is_admin() or public.teaches_child(child_id));

create policy daily_reports_delete on public.daily_reports
  for delete to authenticated
  using (public.is_admin() or public.teaches_child(child_id));

-- =====================================================================
-- messages
-- =====================================================================
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_admin()
    or public.is_parent_of(child_id)
    or public.teaches_child(child_id)
  );

-- Sender must be the current user AND a participant for that child.
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or public.is_parent_of(child_id)
      or public.teaches_child(child_id)
    )
  );

-- Participants may update (e.g. mark read).
create policy messages_update on public.messages
  for update to authenticated
  using (
    public.is_admin()
    or public.is_parent_of(child_id)
    or public.teaches_child(child_id)
  )
  with check (
    public.is_admin()
    or public.is_parent_of(child_id)
    or public.teaches_child(child_id)
  );

create policy messages_admin_delete on public.messages
  for delete to authenticated using (public.is_admin());

-- =====================================================================
-- Billing: fee_plans / invoices / payments
-- Writes are admin-only; parents get read access to their child's records.
-- =====================================================================
create policy fee_plans_admin_all on public.fee_plans
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy invoices_select on public.invoices
  for select to authenticated
  using (public.is_admin() or public.is_parent_of(child_id));

create policy invoices_admin_write on public.invoices
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy payments_select on public.payments
  for select to authenticated
  using (public.is_admin() or public.is_parent_of(child_id));

create policy payments_admin_write on public.payments
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Grants (RLS still governs row visibility). anon gets nothing.
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: supabase/migrations/0003_storage.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: supabase/migrations/0004_new_features.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- FILE: supabase/seed.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

-- =====================================================================
-- Seed data (runs after migrations on `supabase db reset`)
-- Only non-user reference data. Users/children are created via the app
-- so that auth.users + profiles stay consistent.
-- =====================================================================

insert into public.fee_plans (name, amount, billing_cycle, description)
values
  ('Full Day — Monthly',  180.00, 'monthly', 'Full day care, billed monthly.'),
  ('Half Day — Monthly',  110.00, 'monthly', 'Morning session only, billed monthly.'),
  ('Full Day — Termly',   500.00, 'termly',  'Full day care, billed per term (3 terms/year).'),
  ('Registration Fee',     50.00, 'annual',  'One-off annual registration.')
on conflict do nothing;

-- ---------------------------------------------------------------------
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
