-- =====================================================================
-- Shining Light — one-shot setup bundle for a HOSTED Supabase project.
-- Paste this whole file into the Supabase Dashboard -> SQL Editor and Run.
-- It is migrations 0001+0002+0003 followed by the seed, in order.
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

commit;
