import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getParentChildren } from "@/lib/parent"
import { signedUrl } from "@/lib/storage"
import { dateLabel } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { ChildAvatar } from "@/components/child-avatar"
import { DailyReportView } from "@/components/daily-report-view"
import { RealtimeRefresh } from "@/components/realtime-refresh"
import { Card, CardContent } from "@/components/ui/card"
import type { DailyReport } from "@/lib/types/database"

export const metadata = { title: "Daily reports" }

export default async function ParentReportsPage() {
  const profile = await requireRole("parent")
  const children = await getParentChildren(profile.id)
  const supabase = await createClient()

  const childById = new Map(children.map((c) => [c.id, c]))
  const ids = children.map((c) => c.id)

  const { data: reports } = ids.length
    ? await supabase
        .from("daily_reports")
        .select("*")
        .in("child_id", ids)
        .eq("status", "published")
        .order("date", { ascending: false })
        .limit(60)
    : { data: [] }

  const items = await Promise.all(
    ((reports ?? []) as DailyReport[]).map(async (r) => ({
      report: r,
      child: childById.get(r.child_id),
      photoUrls: await Promise.all(
        (r.photos ?? []).map((p) => signedUrl("report-photos", p))
      ),
    }))
  )

  return (
    <>
      <RealtimeRefresh table="daily_reports" channel="parent-reports" />
      <PageHeader
        title="Daily reports"
        description="Published updates from your child's teacher."
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No reports yet. New reports appear here as soon as they&apos;re
            published.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-5">
          {items.map(({ report, child, photoUrls }) => (
            <div key={report.id} className="grid gap-2">
              <div className="flex items-center gap-3">
                {child ? (
                  <ChildAvatar
                    name={child.full_name}
                    photoPath={child.photo_url}
                    className="size-10"
                  />
                ) : null}
                <div>
                  <div className="font-semibold">{child?.full_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {dateLabel(report.date)}
                  </div>
                </div>
              </div>
              <DailyReportView
                report={{
                  meals: report.meals,
                  naps: report.naps,
                  bathroom: report.bathroom,
                  mood: report.mood,
                  activities: report.activities,
                  notes: report.notes,
                  photoUrls,
                }}
              />
            </div>
          ))}
        </div>
      )}
    </>
  )
}
