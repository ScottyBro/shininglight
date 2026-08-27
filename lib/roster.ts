import { createClient } from "@/lib/supabase/server"
import type { AuthorizedPickup } from "@/lib/types/database"

export type RosterChild = {
  id: string
  full_name: string
  photo_url: string | null
  allergies: string[]
  medical_notes: string | null
  authorized_pickups: AuthorizedPickup[]
  classroom_id: string | null
}

export type TeacherRoster = {
  classrooms: { id: string; name: string }[]
  children: RosterChild[]
}

/**
 * The active children in the classrooms a teacher leads, plus those
 * classrooms. Admins pass their id too but typically lead no room (empty).
 */
export async function getTeacherRoster(teacherId: string): Promise<TeacherRoster> {
  const supabase = await createClient()

  const { data: classrooms } = await supabase
    .from("classrooms")
    .select("id, name")
    .eq("teacher_id", teacherId)
    .order("name")

  const ids = (classrooms ?? []).map((c) => c.id)
  if (ids.length === 0) return { classrooms: [], children: [] }

  const { data: children } = await supabase
    .from("children")
    .select(
      "id, full_name, photo_url, allergies, medical_notes, authorized_pickups, classroom_id"
    )
    .in("classroom_id", ids)
    .eq("enrollment_status", "active")
    .order("full_name")

  return {
    classrooms: classrooms ?? [],
    children: (children ?? []) as unknown as RosterChild[],
  }
}
