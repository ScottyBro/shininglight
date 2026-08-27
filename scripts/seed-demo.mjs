/**
 * Seed demo accounts + demo data into a Supabase project.
 *
 *   node --env-file=.env.local scripts/seed-demo.mjs
 *
 * Idempotent: re-running resets the demo users' passwords and upserts data.
 * Uses the service-role key (bypasses RLS), so run it only against a project
 * you own. Creates confirmed login-able accounts via the Auth admin API.
 */
import { createClient } from "@supabase/supabase-js"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. " +
      "Run with: node --env-file=.env.local scripts/seed-demo.mjs"
  )
  process.exit(1)
}

const sb = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = "ShiningLight1!"

// Stable UUIDs so re-runs upsert instead of duplicating.
const ID = {
  room: "00000000-0000-0000-0000-0000000000c1",
  tadiwa: "00000000-0000-0000-0000-000000000a01",
  ruva: "00000000-0000-0000-0000-000000000a02",
  chipo: "00000000-0000-0000-0000-000000000a03",
  invTadiwaAug: "00000000-0000-0000-0000-0000000000d1",
  invRuvaAug: "00000000-0000-0000-0000-0000000000d2",
  invChipoAug: "00000000-0000-0000-0000-0000000000d3",
  invChipoJul: "00000000-0000-0000-0000-0000000000d4",
  payTadiwa: "00000000-0000-0000-0000-0000000000e1",
  payRuva: "00000000-0000-0000-0000-0000000000e2",
  msg1: "00000000-0000-0000-0000-0000000000f1",
  msg2: "00000000-0000-0000-0000-0000000000f2",
}

const USERS = {
  admin: { email: "admin@shininglight.co", full_name: "Admin User", phone: "+263 77 000 0001", role: "admin" },
  teacher: { email: "teacher@shininglight.co", full_name: "Rudo Teacher", phone: "+263 77 000 0002", role: "teacher" },
  tanaka: { email: "tanaka.parent@shininglight.co", full_name: "Tanaka Moyo", phone: "+263 77 000 0003", role: "parent" },
  farai: { email: "farai.parent@shininglight.co", full_name: "Farai Ncube", phone: "+263 77 000 0004", role: "parent" },
}

function todayISO() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Harare",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date())
}
function atToday(hh, mm) {
  const d = todayISO()
  // Africa/Harare is UTC+2; store the UTC instant for hh:mm local.
  const [y, mo, da] = d.split("-").map(Number)
  return new Date(Date.UTC(y, mo - 1, da, hh - 2, mm)).toISOString()
}

async function upsertUser({ email, full_name, phone, role }) {
  const meta = { full_name, phone, role }
  const created = await sb.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: meta,
  })
  let id = created.data?.user?.id
  if (!id) {
    const { data } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    const found = data.users.find((u) => (u.email ?? "").toLowerCase() === email.toLowerCase())
    if (!found) throw new Error(`Could not create/find ${email}: ${created.error?.message}`)
    id = found.id
    await sb.auth.admin.updateUserById(id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: meta,
    })
  }
  await sb.from("profiles").upsert({ id, role, full_name, phone }, { onConflict: "id" })
  console.log(`  ✓ ${role.padEnd(7)} ${email}`)
  return id
}

async function main() {
  console.log("Seeding demo accounts…")
  const ids = {}
  for (const key of Object.keys(USERS)) ids[key] = await upsertUser(USERS[key])

  console.log("Seeding classroom, children, links…")
  await sb.from("classrooms").upsert(
    { id: ID.room, name: "Sunflowers", max_capacity: 20, teacher_id: ids.teacher },
    { onConflict: "id" }
  )

  const contacts = (name, phone, rel) => [{ name, phone, relationship: rel }]
  const pickups = (name, rel, pin) => [{ name, relationship: rel, pin }]

  await sb.from("children").upsert(
    [
      {
        id: ID.tadiwa,
        full_name: "Tadiwa Moyo",
        date_of_birth: "2022-05-14",
        allergies: ["Peanuts"],
        medical_notes: "Mild asthma — blue inhaler in the front pocket of her bag.",
        emergency_contacts: contacts("Tanaka Moyo", "+263 77 000 0003", "Mother"),
        authorized_pickups: pickups("Rumbi Moyo", "Aunt", "4821"),
        classroom_id: ID.room,
        enrollment_status: "active",
      },
      {
        id: ID.ruva,
        full_name: "Ruvarashe Moyo",
        date_of_birth: "2021-02-02",
        allergies: [],
        medical_notes: null,
        emergency_contacts: contacts("Tanaka Moyo", "+263 77 000 0003", "Mother"),
        authorized_pickups: pickups("Rumbi Moyo", "Aunt", "4821"),
        classroom_id: ID.room,
        enrollment_status: "active",
      },
      {
        id: ID.chipo,
        full_name: "Chipo Ncube",
        date_of_birth: "2021-09-20",
        allergies: ["Dairy", "Eggs"],
        medical_notes: null,
        emergency_contacts: contacts("Farai Ncube", "+263 77 000 0004", "Father"),
        authorized_pickups: pickups("Sipho Ncube", "Uncle", "1907"),
        classroom_id: ID.room,
        enrollment_status: "active",
      },
    ],
    { onConflict: "id" }
  )

  await sb.from("parent_children").upsert(
    [
      { parent_id: ids.tanaka, child_id: ID.tadiwa, relationship: "Mother" },
      { parent_id: ids.tanaka, child_id: ID.ruva, relationship: "Mother" },
      { parent_id: ids.farai, child_id: ID.chipo, relationship: "Father" },
    ],
    { onConflict: "parent_id,child_id" }
  )

  console.log("Seeding attendance + daily reports…")
  const date = todayISO()
  await sb.from("attendance").upsert(
    [
      { child_id: ID.tadiwa, date, check_in_at: atToday(8, 5), check_in_by: ids.teacher },
      {
        child_id: ID.chipo,
        date,
        check_in_at: atToday(8, 20),
        check_out_at: atToday(15, 40),
        check_in_by: ids.teacher,
        check_out_by: ids.teacher,
      },
    ],
    { onConflict: "child_id,date" }
  )

  await sb.from("daily_reports").upsert(
    [
      {
        child_id: ID.tadiwa,
        date,
        meals: [{ time: "12:15", food: "Sadza & vegetables", amount: "most" }],
        naps: [{ start: "13:00", end: "14:30" }],
        bathroom: [{ time: "11:00", type: "potty" }],
        mood: "Happy",
        activities: "Painting and outdoor play in the morning; story time after lunch.",
        notes: "Tadiwa had a lovely day and made a card for you!",
        status: "published",
        created_by: ids.teacher,
        published_at: atToday(16, 0),
      },
      {
        child_id: ID.chipo,
        date,
        meals: [{ time: "12:15", food: "Rice & beans", amount: "all" }],
        naps: [{ start: "12:45", end: "14:00" }],
        bathroom: [{ time: "10:30", type: "wet" }],
        mood: "Playful",
        activities: "Building blocks and singing.",
        notes: "Chipo shared toys nicely today.",
        status: "published",
        created_by: ids.teacher,
        published_at: atToday(16, 5),
      },
    ],
    { onConflict: "child_id,date" }
  )

  console.log("Seeding billing…")
  let { data: plan } = await sb
    .from("fee_plans")
    .select("id, amount")
    .eq("name", "Full Day — Monthly")
    .maybeSingle()
  if (!plan) {
    const { data } = await sb
      .from("fee_plans")
      .insert({ name: "Full Day — Monthly", amount: 180, billing_cycle: "monthly", description: "Full day care, billed monthly." })
      .select("id, amount")
      .single()
    plan = data
  }
  const amt = Number(plan.amount)

  await sb.from("invoices").upsert(
    [
      { id: ID.invTadiwaAug, child_id: ID.tadiwa, fee_plan_id: plan.id, period_label: "Aug 2026", amount_due: amt, due_date: "2026-08-31", status: "partial" },
      { id: ID.invRuvaAug, child_id: ID.ruva, fee_plan_id: plan.id, period_label: "Aug 2026", amount_due: amt, due_date: "2026-08-31", status: "paid" },
      { id: ID.invChipoAug, child_id: ID.chipo, fee_plan_id: plan.id, period_label: "Aug 2026", amount_due: amt, due_date: "2026-08-31", status: "unpaid" },
      { id: ID.invChipoJul, child_id: ID.chipo, fee_plan_id: plan.id, period_label: "Jul 2026", amount_due: amt, due_date: "2026-07-31", status: "unpaid" },
    ],
    { onConflict: "id" }
  )

  await sb.from("payments").upsert(
    [
      { id: ID.payTadiwa, invoice_id: ID.invTadiwaAug, child_id: ID.tadiwa, amount: Math.round(amt / 2), method: "ecocash", recorded_by: ids.admin },
      { id: ID.payRuva, invoice_id: ID.invRuvaAug, child_id: ID.ruva, amount: amt, method: "cash", recorded_by: ids.admin },
    ],
    { onConflict: "id" }
  )

  console.log("Seeding messages…")
  await sb.from("messages").upsert(
    [
      { id: ID.msg1, child_id: ID.tadiwa, sender_id: ids.teacher, body: "Good morning! Tadiwa settled in really well today.", created_at: atToday(9, 10) },
      { id: ID.msg2, child_id: ID.tadiwa, sender_id: ids.tanaka, body: "Thank you so much! She was excited to come in.", created_at: atToday(9, 25) },
    ],
    { onConflict: "id" }
  )

  console.log("\nDone. Demo accounts (password for all: " + PASSWORD + "):")
  for (const u of Object.values(USERS)) console.log(`  ${u.role.padEnd(7)} ${u.email}`)
}

main().catch((e) => {
  console.error("\nSeed failed:", e.message ?? e)
  process.exit(1)
})
