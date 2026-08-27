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
