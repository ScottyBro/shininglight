-- =====================================================================
-- RLS regression test: a parent can only read their OWN child's data,
-- never another family's. Run against a local Supabase DB:
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/parent_isolation_test.sql
--
-- The whole thing runs in a transaction and rolls back, so it leaves no
-- residue. Any failed assertion aborts with a non-zero exit code.
-- =====================================================================
begin;

-- --- Fixture: two unrelated families -------------------------------------
-- Insert auth users directly (superuser context). The on_auth_user_created
-- trigger creates matching public.profiles rows with role 'parent'.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'parent1@test.local', 'x', now(), now(),
   '{"provider":"email"}', '{"role":"parent","full_name":"Parent One"}'),
  ('22222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'parent2@test.local', 'x', now(), now(),
   '{"provider":"email"}', '{"role":"parent","full_name":"Parent Two"}');

insert into public.children (id, full_name) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Child A'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Child B');

insert into public.parent_children (parent_id, child_id) values
  ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('22222222-2222-2222-2222-222222222222', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

insert into public.invoices (child_id, period_label, amount_due, due_date) values
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Aug 2026', 180, '2026-08-31'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Aug 2026', 180, '2026-08-31');

-- --- Act as Parent One ---------------------------------------------------
set local role authenticated;
select set_config(
  'request.jwt.claims',
  json_build_object('sub', '11111111-1111-1111-1111-111111111111',
                    'role', 'authenticated')::text,
  true
);

do $$
declare
  own_children int;
  other_children int;
  own_invoices int;
  other_invoices int;
begin
  select count(*) into own_children  from public.children where id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  select count(*) into other_children from public.children where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
  select count(*) into own_invoices  from public.invoices where child_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  select count(*) into other_invoices from public.invoices where child_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  assert own_children   = 1, 'FAIL: parent should see their own child';
  assert other_children = 0, 'FAIL: parent must NOT see another family''s child';
  assert own_invoices   = 1, 'FAIL: parent should see their own child''s invoice';
  assert other_invoices = 0, 'FAIL: parent must NOT see another family''s invoice';

  raise notice 'PASS: parent isolation enforced (own=%, other=%)', own_children, other_children;
end;
$$;

reset role;
rollback;
