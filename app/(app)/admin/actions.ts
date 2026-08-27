"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { parseList } from "@/lib/format"
import type { Database, EnrollmentStatus } from "@/lib/types/database"

export type FormState = { error?: string; message?: string }

// --- Shared validation ------------------------------------------------------

const emergencyContactSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  relationship: z.string().trim().optional().default(""),
})

const authorizedPickupSchema = z.object({
  name: z.string().trim().min(1),
  relationship: z.string().trim().optional().default(""),
  pin: z.string().trim().optional().default(""),
  photo_url: z.string().nullish(),
})

/** Parse a JSON array field, dropping malformed/empty rows. */
function parseJsonArray<T>(raw: FormDataEntryValue | null, schema: z.ZodType<T>): T[] {
  if (typeof raw !== "string" || raw.trim() === "") return []
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []
  const out: T[] = []
  for (const item of data) {
    const parsed = schema.safeParse(item)
    if (parsed.success) out.push(parsed.data)
  }
  return out
}

const childCoreSchema = z.object({
  full_name: z.string().trim().min(2, "Please enter the child's full name."),
  date_of_birth: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  medical_notes: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  classroom_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "none" ? v : null)),
  enrollment_status: z
    .enum(["active", "waitlisted", "withdrawn"])
    .default("active"),
})

/** Upload an optional photo File to `child-photos`; return its object path. */
async function uploadChildPhoto(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  photo: FormDataEntryValue | null
): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0) return null
  const ext = photo.name.split(".").pop()?.toLowerCase() || "jpg"
  const path = `${childId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage
    .from("child-photos")
    .upload(path, photo, { contentType: photo.type || undefined, upsert: true })
  if (error) return null
  return path
}

// --- Children ---------------------------------------------------------------

export async function enrollChild(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")

  const parsed = childCoreSchema.safeParse({
    full_name: formData.get("full_name"),
    date_of_birth: formData.get("date_of_birth") ?? undefined,
    medical_notes: formData.get("medical_notes") ?? undefined,
    classroom_id: formData.get("classroom_id") ?? undefined,
    enrollment_status: formData.get("enrollment_status") ?? "active",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const allergies = parseList(formData.get("allergies")?.toString())
  const emergency_contacts = parseJsonArray(
    formData.get("emergency_contacts"),
    emergencyContactSchema
  )
  const authorized_pickups = parseJsonArray(
    formData.get("authorized_pickups"),
    authorizedPickupSchema
  )

  const supabase = await createClient()
  const { data: child, error } = await supabase
    .from("children")
    .insert({
      ...parsed.data,
      allergies,
      emergency_contacts,
      authorized_pickups,
    })
    .select("id")
    .single()

  if (error || !child) {
    return { error: error?.message ?? "Could not enroll the child." }
  }

  const photoPath = await uploadChildPhoto(supabase, child.id, formData.get("photo"))
  if (photoPath) {
    await supabase.from("children").update({ photo_url: photoPath }).eq("id", child.id)
  }

  revalidatePath("/admin/children")
  redirect(`/admin/children/${child.id}`)
}

export async function updateChild(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")

  const id = formData.get("id")?.toString()
  if (!id) return { error: "Missing child id." }

  const parsed = childCoreSchema.safeParse({
    full_name: formData.get("full_name"),
    date_of_birth: formData.get("date_of_birth") ?? undefined,
    medical_notes: formData.get("medical_notes") ?? undefined,
    classroom_id: formData.get("classroom_id") ?? undefined,
    enrollment_status: formData.get("enrollment_status") ?? "active",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const update: Database["public"]["Tables"]["children"]["Update"] = {
    ...parsed.data,
    allergies: parseList(formData.get("allergies")?.toString()),
    emergency_contacts: parseJsonArray(
      formData.get("emergency_contacts"),
      emergencyContactSchema
    ),
    authorized_pickups: parseJsonArray(
      formData.get("authorized_pickups"),
      authorizedPickupSchema
    ),
  }

  const photoPath = await uploadChildPhoto(supabase, id, formData.get("photo"))
  if (photoPath) update.photo_url = photoPath

  const { error } = await supabase.from("children").update(update).eq("id", id)
  if (error) return { error: error.message }

  revalidatePath(`/admin/children/${id}`)
  revalidatePath("/admin/children")
  return { message: "Saved." }
}

export async function setEnrollmentStatus(id: string, status: EnrollmentStatus) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase.from("children").update({ enrollment_status: status }).eq("id", id)
  revalidatePath(`/admin/children/${id}`)
  revalidatePath("/admin/children")
}

// --- Classrooms -------------------------------------------------------------

const classroomSchema = z.object({
  name: z.string().trim().min(1, "Classroom name is required."),
  max_capacity: z.coerce.number().int().min(1).max(200).default(20),
  teacher_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "none" ? v : null)),
})

export async function createClassroom(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")
  const parsed = classroomSchema.safeParse({
    name: formData.get("name"),
    max_capacity: formData.get("max_capacity") ?? 20,
    teacher_id: formData.get("teacher_id") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("classrooms").insert(parsed.data)
  if (error) return { error: error.message }

  revalidatePath("/admin/classrooms")
  return { message: "Classroom created." }
}

export async function assignTeacher(classroomId: string, teacherId: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase
    .from("classrooms")
    .update({ teacher_id: teacherId === "none" ? null : teacherId })
    .eq("id", classroomId)
  revalidatePath("/admin/classrooms")
}

export async function deleteClassroom(classroomId: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase.from("classrooms").delete().eq("id", classroomId)
  revalidatePath("/admin/classrooms")
}

// --- Parent linking ---------------------------------------------------------

const linkSchema = z.object({
  parent_id: z.string().uuid("Choose a parent."),
  child_id: z.string().uuid("Choose a child."),
  relationship: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
})

export async function linkParent(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")
  const parsed = linkSchema.safeParse({
    parent_id: formData.get("parent_id"),
    child_id: formData.get("child_id"),
    relationship: formData.get("relationship") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("parent_children")
    .upsert(parsed.data, { onConflict: "parent_id,child_id" })
  if (error) return { error: error.message }

  revalidatePath("/admin/people")
  revalidatePath(`/admin/children/${parsed.data.child_id}`)
  return { message: "Parent linked." }
}

export async function unlinkParent(parentId: string, childId: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase
    .from("parent_children")
    .delete()
    .eq("parent_id", parentId)
    .eq("child_id", childId)
  revalidatePath("/admin/people")
  revalidatePath(`/admin/children/${childId}`)
}
