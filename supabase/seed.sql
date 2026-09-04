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
