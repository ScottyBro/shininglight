import Link from "next/link"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Admin overview" }

export default async function AdminHome() {
  const profile = await requireRole("admin")
  const supabase = await createClient()

  const [children, classrooms, unpaid, balances] = await Promise.all([
    supabase
      .from("children")
      .select("id", { count: "exact", head: true })
      .eq("enrollment_status", "active"),
    supabase.from("classrooms").select("id", { count: "exact", head: true }),
    supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .in("status", ["unpaid", "partial", "overdue"]),
    supabase.from("child_balances").select("balance"),
  ])

  const balanceRows = (balances.data ?? []) as { balance: number | null }[]
  const outstanding = balanceRows.reduce(
    (sum, b) => sum + Number(b.balance ?? 0),
    0
  )

  const stats = [
    { label: "Active children", value: children.count ?? 0, href: "/admin/children" },
    { label: "Classrooms", value: classrooms.count ?? 0, href: "/admin/classrooms" },
    { label: "Open invoices", value: unpaid.count ?? 0, href: "/admin/billing" },
    {
      label: "Outstanding",
      value: `$${outstanding.toFixed(2)}`,
      href: "/admin/billing",
    },
  ]

  return (
    <>
      <PageHeader
        title={`Welcome, ${profile.full_name ?? "Admin"}`}
        description="Here's a snapshot of the school today."
        action={
          <Button asChild>
            <Link href="/admin/children/new">Enroll a child</Link>
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="transition-colors hover:border-primary/40">
              <CardHeader className="pb-1">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {s.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-extrabold tracking-tight">
                  {s.value}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <QuickLink
          href="/admin/children/new"
          title="Enroll a child"
          body="Add a full profile: photo, allergies, emergency contacts and authorized pickups."
        />
        <QuickLink
          href="/admin/classrooms"
          title="Classrooms & teachers"
          body="Create classrooms and assign teachers."
        />
        <QuickLink
          href="/admin/people"
          title="Link parents"
          body="Connect parent accounts to their children."
        />
        <QuickLink
          href="/admin/billing"
          title="Billing"
          body="Fee plans, invoices, payments and receipts."
        />
      </div>
    </>
  )
}

function QuickLink({
  href,
  title,
  body,
}: {
  href: string
  title: string
  body: string
}) {
  return (
    <Link href={href}>
      <Card className="h-full transition-colors hover:border-primary/40">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {body}
        </CardContent>
      </Card>
    </Link>
  )
}
