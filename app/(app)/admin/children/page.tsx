import Link from "next/link"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ageLabel } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { ChildAvatar } from "@/components/child-avatar"
import { ChildSafetyBadges } from "@/components/child-badges"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import type { EnrollmentStatus } from "@/lib/types/database"

export const metadata = { title: "Children" }

const STATUS_VARIANT: Record<
  EnrollmentStatus,
  "default" | "secondary" | "outline"
> = {
  active: "default",
  waitlisted: "secondary",
  withdrawn: "outline",
}

export default async function AdminChildrenPage() {
  await requireRole("admin")
  const supabase = await createClient()

  const { data: children } = await supabase
    .from("children")
    .select(
      "id, full_name, date_of_birth, photo_url, allergies, medical_notes, enrollment_status, classroom:classrooms(name)"
    )
    .order("full_name")

  const rows = (children ?? []) as unknown as Array<{
    id: string
    full_name: string
    date_of_birth: string | null
    photo_url: string | null
    allergies: string[]
    medical_notes: string | null
    enrollment_status: EnrollmentStatus
    classroom: { name: string } | null
  }>

  return (
    <>
      <PageHeader
        title="Children"
        description={`${rows.length} enrolled`}
        action={
          <Button asChild>
            <Link href="/admin/children/new">Enroll a child</Link>
          </Button>
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No children yet.{" "}
            <Link href="/admin/children/new" className="text-primary hover:underline">
              Enroll the first one
            </Link>
            .
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((child) => (
            <Link key={child.id} href={`/admin/children/${child.id}`}>
              <Card className="h-full transition-colors hover:border-primary/40">
                <CardContent className="flex flex-col gap-3 py-4">
                  <div className="flex items-center gap-3">
                    <ChildAvatar
                      name={child.full_name}
                      photoPath={child.photo_url}
                      className="size-12"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-semibold">
                        {child.full_name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {[ageLabel(child.date_of_birth), child.classroom?.name]
                          .filter(Boolean)
                          .join(" · ") || "Unassigned"}
                      </div>
                    </div>
                    <Badge variant={STATUS_VARIANT[child.enrollment_status]}>
                      {child.enrollment_status}
                    </Badge>
                  </div>
                  <ChildSafetyBadges
                    allergies={child.allergies}
                    medicalNotes={child.medical_notes}
                  />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
