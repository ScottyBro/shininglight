import { CalendarClock } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { schoolToday, dateLabel } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "Schedule" }

function timeRange(start: string, end: string) {
  const fmt = (t: string) => t.slice(0, 5)
  return `${fmt(start)} – ${fmt(end)}`
}

export default async function TeacherSchedulePage() {
  const profile = await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const today = schoolToday()

  const { data: shifts } = await supabase
    .from("shifts")
    .select("id, date, start_time, end_time, notes, classroom:classrooms(name)")
    .eq("teacher_id", profile.id)
    .gte("date", today)
    .order("date")
    .order("start_time")

  const rows = (shifts ?? []) as unknown as Array<{
    id: string
    date: string
    start_time: string
    end_time: string
    notes: string | null
    classroom: { name: string } | null
  }>

  return (
    <>
      <PageHeader title="Schedule" description="Your upcoming shifts." />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No upcoming shifts scheduled.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rows.map((s) => (
            <Card key={s.id}>
              <CardContent className="flex items-start gap-3 py-3">
                <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <CalendarClock className="size-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{dateLabel(s.date)}</div>
                  <div className="text-sm text-muted-foreground">
                    {timeRange(s.start_time, s.end_time)}
                    {s.classroom?.name ? ` · ${s.classroom.name}` : ""}
                  </div>
                  {s.notes ? (
                    <p className="mt-1 text-sm text-muted-foreground">{s.notes}</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
