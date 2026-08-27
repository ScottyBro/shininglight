import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { CreateUser } from "@/components/admin/create-user"
import { PeopleLink } from "@/components/admin/people-link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

export const metadata = { title: "People" }

export default async function PeoplePage() {
  await requireRole("admin")
  const supabase = await createClient()

  const [{ data: profiles }, { data: children }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .order("full_name"),
    supabase.from("children").select("id, full_name").order("full_name"),
  ])

  const all = profiles ?? []
  const teachers = all.filter((p) => p.role === "teacher")
  const parents = all.filter((p) => p.role === "parent")
  const admins = all.filter((p) => p.role === "admin")

  return (
    <>
      <PageHeader
        title="People"
        description="Staff and family accounts. Link parents to their children."
      />

      <div className="grid gap-4">
        <CreateUser />

        <PeopleLink
          parents={parents.map((p) => ({ id: p.id, full_name: p.full_name }))}
          childOptions={children ?? []}
        />

        <div className="grid gap-4 md:grid-cols-3">
          <PeopleColumn title="Administrators" people={admins} badge="admin" />
          <PeopleColumn title="Teachers" people={teachers} badge="teacher" />
          <PeopleColumn title="Parents" people={parents} badge="parent" />
        </div>
      </div>
    </>
  )
}

function PeopleColumn({
  title,
  people,
  badge,
}: {
  title: string
  people: { id: string; full_name: string | null; phone: string | null }[]
  badge: string
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">{title}</CardTitle>
        <Badge variant="secondary">{people.length}</Badge>
      </CardHeader>
      <CardContent className="grid gap-2 text-sm">
        {people.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          people.map((p) => (
            <div key={p.id} className="rounded-lg border p-2.5">
              <div className="font-medium">{p.full_name ?? "Unnamed"}</div>
              {p.phone ? (
                <div className="text-xs text-muted-foreground">{p.phone}</div>
              ) : null}
              <span className="sr-only">{badge}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
