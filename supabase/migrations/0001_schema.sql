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
