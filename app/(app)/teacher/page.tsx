import Link from "next/link"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export const metadata = { title: "Today" }

export default async function TeacherHome() {
  const profile = await requireRole("teacher")
  const supabase = await createClient()

  const { data: classrooms } = await supabase
    .from("classrooms")
    .select("id, name")
    .eq("teacher_id", profile.id)

  const classroomIds = (classrooms ?? []).map((c) => c.id)

  let childCount = 0
  if (classroomIds.length) {
    const { count } = await supabase
      .from("children")
      .select("id", { count: "exact", head: true })
      .in("classroom_id", classroomIds)
      .eq("enrollment_status", "active")
    childCount = count ?? 0
  }

  return (
    <>
      <PageHeader
        title={`Good day, ${profile.full_name ?? "Teacher"}`}
        description={new Date().toLocaleDateString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
      />

      {classroomIds.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No classroom assigned yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            An administrator needs to assign you to a classroom before you can
            take attendance or write reports.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                My classroom{classroomIds.length > 1 ? "s" : ""}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold">
                {(classrooms ?? []).map((c) => c.name).join(", ")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {childCount} active {childCount === 1 ? "child" : "children"}
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle>Attendance</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild size="lg">
                <Link href="/teacher/attendance">Open today&apos;s roster</Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/teacher/reports">Write daily reports</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  )
}
