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
