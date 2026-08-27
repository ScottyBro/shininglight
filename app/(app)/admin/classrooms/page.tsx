import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { ClassroomManager } from "@/components/admin/classroom-manager"

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
      supabase.from("children").select("classroom_id"),
    ])

  const counts = new Map<string, number>()
  for (const row of children ?? []) {
    const cid = (row as { classroom_id: string | null }).classroom_id
    if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1)
  }

  const rooms = (classrooms ?? []).map((r) => ({
    ...r,
    child_count: counts.get(r.id) ?? 0,
  }))

  return (
    <>
      <PageHeader
        title="Classrooms"
        description="Create classrooms and assign a lead teacher to each."
      />
      <ClassroomManager classrooms={rooms} teachers={teachers ?? []} />
    </>
  )
}
