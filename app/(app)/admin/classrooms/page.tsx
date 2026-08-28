import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { ClassroomManager } from "@/components/admin/classroom-manager"
import type { RosterChild } from "@/components/admin/classroom-manager"

export const metadata = { title: "Classrooms" }

export default async function ClassroomsPage() {
  await requireRole("admin")
  const supabase = await createClient()

  const [{ data: classrooms }, { data: teachers }, { data: children }] =
    await Promise.all([
      supabase
        .from("classrooms")
        .select("id, name, max_capacity, teacher_id")
        .order("name"),
      supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .order("full_name"),
      supabase
        .from("children")
        .select("id, full_name, classroom_id, enrollment_status")
        .neq("enrollment_status", "withdrawn")
        .order("full_name"),
    ])

  const rosterByRoom = new Map<string, RosterChild[]>()
  const activeCounts = new Map<string, number>()
  for (const c of children ?? []) {
    if (!c.classroom_id) continue
    const list = rosterByRoom.get(c.classroom_id) ?? []
    list.push({
      id: c.id,
      full_name: c.full_name,
      enrollment_status: c.enrollment_status,
    })
    rosterByRoom.set(c.classroom_id, list)
    if (c.enrollment_status === "active") {
      activeCounts.set(c.classroom_id, (activeCounts.get(c.classroom_id) ?? 0) + 1)
    }
  }

  const rooms = (classrooms ?? []).map((r) => ({
    ...r,
    child_count: activeCounts.get(r.id) ?? 0,
    roster: rosterByRoom.get(r.id) ?? [],
  }))

  return (
    <>
      <PageHeader
        title="Classrooms"
        description="Create classrooms, assign teachers, and manage rosters."
      />
      <ClassroomManager classrooms={rooms} teachers={teachers ?? []} />
    </>
  )
}
