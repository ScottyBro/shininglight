import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { schoolToday } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { ScheduleManager } from "@/components/admin/schedule-manager"
import type { ShiftRow } from "@/components/admin/schedule-manager"

export const metadata = { title: "Schedule" }

export default async function AdminSchedulePage() {
  await requireRole("admin")
  const supabase = await createClient()
  const today = schoolToday()

  const [{ data: shifts }, { data: teachers }, { data: classrooms }] =
    await Promise.all([
      supabase
        .from("shifts")
        .select(
          "id, date, start_time, end_time, notes, teacher:profiles!shifts_teacher_id_fkey(id, full_name), classroom:classrooms(id, name)"
        )
        .gte("date", today)
        .order("date")
        .order("start_time"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .order("full_name"),
      supabase.from("classrooms").select("id, name").order("name"),
    ])

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Assign upcoming shifts to teachers."
      />
      <ScheduleManager
        shifts={(shifts ?? []) as unknown as ShiftRow[]}
        teachers={teachers ?? []}
        classrooms={classrooms ?? []}
      />
    </>
  )
}
