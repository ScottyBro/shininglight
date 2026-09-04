import Link from "next/link"
import { ChevronRight } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { getTeacherRoster } from "@/lib/roster"
import { PageHeader } from "@/components/page-header"
import { ChildAvatar } from "@/components/child-avatar"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "Milestones" }

export default async function TeacherMilestonesPage() {
  const profile = await requireRole(["teacher", "admin"])
  const { children } = await getTeacherRoster(profile.id)

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Track each child's developmental progress."
      />

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No children in your classroom yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {children.map((child) => (
            <Link key={child.id} href={`/teacher/milestones/${child.id}`}>
              <Card className="transition-colors hover:border-primary/40">
                <CardContent className="flex items-center gap-3 py-3">
                  <ChildAvatar
                    name={child.full_name}
                    photoPath={child.photo_url}
                    className="size-11"
                  />
                  <div className="min-w-0 flex-1 font-medium">{child.full_name}</div>
                  <ChevronRight className="size-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}
