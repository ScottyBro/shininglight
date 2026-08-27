# Shining Light Pre-School — Management System

Attendance, daily reports, billing, and family messaging for Shining Light
Pre-School. Mobile-first, role-based (Admin / Teacher / Parent), with an
AI-assisted reporting layer.

## Tech stack

| Concern            | Choice                                                  |
| ------------------ | ------------------------------------------------------- |
| Framework          | Next.js 15 (App Router) + TypeScript                    |
| Styling / UI       | Tailwind CSS v4 + shadcn/ui (Base UI primitives)        |
| Backend / DB / Auth| Supabase (Postgres, Auth, Storage, Realtime) via `@supabase/ssr` |
| PDF (receipts)     | `pdf-lib` (server-side)                                 |
| AI                 | Anthropic Claude API (server-only, model via env)       |
| Hosting            | Vercel                                                  |

### Notable decisions
- **Next.js is pinned to the 15.x line** per the brief (the current
  `create-next-app` ships 16; we intentionally stay on 15).
- This shadcn distribution is built on **Base UI** (`@base-ui/react`), not
  Radix. The `Button` has been extended to accept `asChild` (mapped onto Base
  UI's `render` prop) so composition with `next/link` stays ergonomic.
- Photo storage buckets are **private**; images are served via short-lived
  signed URLs (`lib/storage.ts`).

## Prerequisites
- Node.js 20+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local Supabase)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`npm i -g supabase` or `scoop install supabase`)

## Setup

Pick **one** of the two paths below. Option A needs Docker; Option B does not.

### Option A — Local Supabase in Docker

```bash
# 1. Install dependencies
npm install

# 2. Start local Supabase (Postgres, Auth, Storage, Studio) in Docker.
#    This applies everything in supabase/migrations + supabase/seed.sql.
npm run db:start        # = supabase start

# 3. Confirm the printed anon key / service_role key match .env.local.
#    (The defaults in .env.local are the standard local demo keys.)

# 4. Run the dev server
npm run dev
```

Then open http://localhost:3000. Local Supabase Studio is at
http://127.0.0.1:54323, and the local email inbox (for any confirmation mails)
is at http://127.0.0.1:54324.

### Option B — Hosted Supabase project (no Docker required)

Use this if you don't have Docker. You develop locally but point at a free
cloud Supabase project.

1. Create a project at https://supabase.com/dashboard (note the project ref).
2. Apply the schema. Two ways:
   - **CLI (recommended):**
     ```bash
     npx supabase login
     npx supabase link --project-ref <your-project-ref>
     npm run db:push       # pushes supabase/migrations/* to the cloud DB
     ```
     Then paste the contents of `supabase/seed.sql` into the dashboard's
     **SQL Editor** and run it (optional reference fee plans).
   - **Dashboard only:** open the **SQL Editor** and run, in order, the
     contents of `supabase/migrations/0001_schema.sql`, `0002_rls.sql`,
     `0003_storage.sql`, then `supabase/seed.sql`.
3. In **Project Settings → API**, copy the values into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role key>   # server-only
   ANTHROPIC_API_KEY=<your key>                   # needed for step 10
   ```
4. (Optional) **Authentication → Providers → Email:** turn *off* "Confirm
   email" for faster testing so sign-up logs you straight in.
5. `npm run dev` and open http://localhost:3000.

> **Accounts are admin-created — there is no public sign-up.** Bootstrap the
> first admin (and a full set of demo accounts + data) with the seed script
> below; after that, admins create staff and parents from **Admin → People →
> Create an account**.

## Demo accounts & data

Seed login-able demo accounts and a realistic dataset (classroom, children with
allergies/pickups, attendance, published reports, invoices/payments, messages)
straight into your project:

```bash
node --env-file=.env.local scripts/seed-demo.mjs
```

It uses the service-role key from `.env.local`, is idempotent (safe to re-run —
it resets the demo passwords and upserts data), and prints the accounts when
done. All demo accounts share the password **`ShiningLight1!`**:

| Role    | Email                          |
| ------- | ------------------------------ |
| Admin   | `admin@shininglight.co`        |
| Teacher | `teacher@shininglight.co`      |
| Parent  | `tanaka.parent@shininglight.co` (2 children) |
| Parent  | `farai.parent@shininglight.co`  |

> Local sign-up is configured to **not** require email confirmation
> (`supabase/config.toml`), so creating an account signs you straight in — handy
> for creating the first Admin account to test with.

### Resetting the database
Re-apply all migrations and reseed from scratch:

```bash
supabase db reset
```

### Running the RLS isolation test
Proves a parent cannot read another family's data:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" \
  -v ON_ERROR_STOP=1 -f supabase/tests/parent_isolation_test.sql
```

A `PASS:` notice means the policies hold; any failed assertion aborts.

## Project structure

```
app/
  (auth)/            login + signup (public)
  (app)/             authenticated, role-gated shell
    admin/  teacher/  parent/  dashboard/
  auth/actions.ts    login / signup / signout server actions
  api/health/        health check
components/
  ui/                shadcn/ui components
  app-shell.tsx      responsive nav (sidebar + mobile bottom-nav)
lib/
  supabase/          browser / server / middleware clients
  auth.ts            getUser / getProfile / requireRole helpers
  types/database.ts  hand-authored DB types (kept in sync with migrations)
supabase/
  migrations/        0001 schema · 0002 RLS · 0003 storage
  seed.sql           reference data (fee plans)
  tests/             RLS regression test
```

## Build roadmap

- [x] 1. Scaffold + deploy skeleton
- [x] 2. Schema + RLS (incl. billing) as migrations
- [x] 3. Auth & roles (login/signup, role-gated routes)
- [x] 4. Admin core (enroll children, classrooms, link parents)
- [x] 5. Attendance (roster check-in/out, allergy badges, pickup verification)
- [x] 6. Daily reports (manual: meals, naps, bathroom, mood, activities, photos)
- [x] 7. Billing (fee plans, invoices, payments, PDF receipts, balances)
- [x] 8. Parent portal (realtime published reports, invoices/balance)
- [x] 9. Messaging (per-child teacher ↔ parent, realtime)
- [x] 10. AI layer (drafted reports, message drafting + translation)
- [x] 11. PWA + offline (installable, offline reads, attendance/report write queue)

## PWA & offline

- Installable ("Add to home screen") via `public/manifest.webmanifest` + app
  icons. The service worker (`public/sw.js`) precaches the app shell, serves
  previously-visited pages offline (network-first with a cached fallback and an
  `/offline` page), and cache-firsts static assets. Supabase requests (data,
  auth, realtime) always hit the network and are never cached.
- **Offline write queue** (`lib/offline/`): the two during-the-day staff flows —
  attendance check-in/out and daily-report entry — are queued to IndexedDB when
  offline and replay automatically on reconnect (single-writer, last-write-wins).
  Attendance updates optimistically; reports queue as drafts (new photo uploads
  need a connection). A status pill shows offline / pending / syncing state.
- The service worker only registers in a production build (`npm run build &&
  npm start`), not in `next dev`.

## Local production builds (Windows)

If `npm run build` crashes with a segfault / exit code `3221225477`, the Next
build worker ran out of heap. Give it more memory:

```bash
NODE_OPTIONS=--max-old-space-size=6144 npm run build
```

Vercel's build environment has ample memory, so this only affects local builds.

## Deploying to Vercel
1. Push to GitHub and import the repo in Vercel.
2. Create a hosted Supabase project and run the migrations against it
   (`supabase link` + `supabase db push`).
3. Set the environment variables from `.env.example` in the Vercel project
   (use the hosted project's URL + keys, and your `ANTHROPIC_API_KEY`).
