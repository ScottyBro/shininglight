import Link from "next/link"
import { notFound } from "next/navigation"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ageLabel } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ChildAvatar } from "@/components/child-avatar"
import { ChildSafetyBadges } from "@/components/child-badges"
import { ChildForm } from "@/components/admin/child-form"
import { ChildParentLink } from "@/components/admin/child-parent-link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  AuthorizedPickup,
  Child,
  EmergencyContact,
} from "@/lib/types/database"

export const metadata = { title: "Child profile" }

export default async function ChildDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requireRole("admin")
  const { id } = await params
  const supabase = await createClient()

  const { data: child } = await supabase
    .from("children")
    .select("*")
    .eq("id", id)
    .single()

  if (!child) notFound()
  const c = child as Child

  const [{ data: classrooms }, { data: links }, { data: parents }] =
    await Promise.all([
      supabase.from("classrooms").select("id, name").order("name"),
      supabase
        .from("parent_children")
        .select("relationship, parent:profiles(id, full_name, phone)")
        .eq("child_id", id),
      supabase
        .from("profiles")
        .select("id, full_name, phone")
        .eq("role", "parent")
        .order("full_name"),
    ])

  const linkedParents = (links ?? []) as unknown as Array<{
    relationship: string | null
    parent: { id: string; full_name: string | null; phone: string | null } | null
  }>
  const contacts = c.emergency_contacts as EmergencyContact[]
  const pickups = c.authorized_pickups as AuthorizedPickup[]

  return (
    <>
      <PageHeader
        title={c.full_name}
        description={
          [ageLabel(c.date_of_birth), c.enrollment_status]
            .filter(Boolean)
            .join(" · ")
        }
      />

      <div className="mb-5 flex items-center gap-4">
        <ChildAvatar name={c.full_name} photoPath={c.photo_url} className="size-16" />
        <ChildSafetyBadges allergies={c.allergies} medicalNotes={c.medical_notes} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="edit">Edit</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 grid gap-4">
          {c.medical_notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Medical notes</CardTitle>
              </CardHeader>
              <CardContent className="whitespace-pre-wrap text-sm">
                {c.medical_notes}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Emergency contacts</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {contacts.length === 0 ? (
                <p className="text-muted-foreground">None on file.</p>
              ) : (
                contacts.map((ct, i) => (
                  <div key={i} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {ct.name}
                      {ct.relationship ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {ct.relationship}
                        </span>
                      ) : null}
                    </span>
                    <a href={`tel:${ct.phone}`} className="text-primary">
                      {ct.phone}
                    </a>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Authorized pickups</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2 text-sm">
              {pickups.length === 0 ? (
                <p className="text-muted-foreground">None on file.</p>
              ) : (
                pickups.map((p, i) => (
                  <div key={i} className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">
                      {p.name}
                      {p.relationship ? (
                        <span className="text-muted-foreground">
                          {" "}
                          · {p.relationship}
                        </span>
                      ) : null}
                    </span>
                    {p.pin ? (
                      <Badge variant="secondary">PIN {p.pin}</Badge>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <ChildParentLink
            childId={c.id}
            parents={parents ?? []}
            linked={linkedParents}
          />
        </TabsContent>

        <TabsContent value="edit" className="mt-4">
          <ChildForm classrooms={classrooms ?? []} child={c} />
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/admin/children" className="hover:underline">
              ← Back to all children
            </Link>
          </p>
        </TabsContent>
      </Tabs>
    </>
  )
}
