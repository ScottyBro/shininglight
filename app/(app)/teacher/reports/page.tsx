import Link from "next/link"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTeacherRoster } from "@/lib/roster"
import { schoolToday, dateLabel } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { ChildAvatar } from "@/components/child-avatar"
import { ChildSafetyBadges } from "@/components/child-badges"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ChevronRight } from "lucide-react"
import type { ReportStatus } from "@/lib/types/database"

export const metadata = { title: "Daily reports" }

export default async function ReportsListPage() {
  const profile = await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const { children } = await getTeacherRoster(profile.id)
  const date = schoolToday()

  const ids = children.map((c) => c.id)
  const { data: reports } = ids.length
    ? await supabase
        .from("daily_reports")
        .select("child_id, status")
        .in("child_id", ids)
        .eq("date", date)
    : { data: [] }

  const statusByChild = new Map<string, ReportStatus>(
    (reports ?? []).map((r) => [r.child_id, r.status])
  )

  return (
    <>
      <PageHeader title="Daily reports" description={dateLabel(date)} />

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No active children in your classroom yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {children.map((child) => {
            const status = statusByChild.get(child.id)
            return (
              <Link key={child.id} href={`/teacher/reports/${child.id}`}>
                <Card className="transition-colors hover:border-primary/40">
                  <CardContent className="flex items-center gap-3 py-3">
                    <ChildAvatar
                      name={child.full_name}
                      photoPath={child.photo_url}
                      className="size-11"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">{child.full_name}</div>
                      <ChildSafetyBadges
                        allergies={child.allergies}
                        medicalNotes={child.medical_notes}
                        className="mt-1"
                      />
                    </div>
                    <ReportStatusBadge status={status} />
                    <ChevronRight className="size-5 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </>
  )
}

function ReportStatusBadge({ status }: { status: ReportStatus | undefined }) {
  if (status === "published")
    return <Badge>Published</Badge>
  if (status === "draft")
    return <Badge variant="secondary">Draft</Badge>
  return <Badge variant="outline">Not started</Badge>
}
