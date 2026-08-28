"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { parseList } from "@/lib/format"
import { uuidField } from "@/lib/validation"
import type { Database, EnrollmentStatus } from "@/lib/types/database"

export type FormState = { error?: string; message?: string }

// --- User accounts (admin-created; there is no public sign-up) -------------

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))

const createUserSchema = z.object({
  full_name: z.string().trim().min(2, "Enter the person's full name."),
  email: emailField,
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  role: z.enum(["admin", "teacher", "parent"]),
  password: z.string().min(8, "Temporary password must be at least 8 characters."),
})

/**
 * Create a staff or parent account. Accounts are only ever created here by an
 * admin (public sign-up is disabled). Uses the service-role client to create a
 * confirmed auth user; the handle_new_user trigger + this upsert set the
 * profile's role/name/phone.
 */
export async function createUserAccount(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")

  const parsed = createUserSchema.safeParse({
    full_name: formData.get("full_name"),
    email: formData.get("email"),
    phone: formData.get("phone") ?? undefined,
    role: formData.get("role"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const { email, password, full_name, phone, role } = parsed.data
  const admin = createAdminClient()

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name, phone, role },
  })
  if (error || !data.user) {
    return { error: error?.message ?? "Could not create the account." }
  }

  // Ensure the profile matches (the trigger creates it; this makes role/name
  // authoritative even if metadata handling ever changes).
  await admin
    .from("profiles")
    .upsert({ id: data.user.id, role, full_name, phone }, { onConflict: "id" })

  revalidatePath("/admin/people")
  return {
    message: `Account created for ${email}. Share the temporary password so they can sign in.`,
  }
}

const resetPasswordSchema = z.object({
  user_id: uuidField(),
  password: z.string().min(8, "Temporary password must be at least 8 characters."),
})

/**
 * Set a new temporary password for an existing account. There is no public
 * sign-up and self-service reset depends on email delivery being configured,
 * so this is the front-desk fallback: hand the person a new temp password
 * directly.
 */
export async function resetUserPassword(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")
  const parsed = resetPasswordSchema.safeParse({
    user_id: formData.get("user_id"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(parsed.data.user_id, {
    password: parsed.data.password,
  })
  if (error) return { error: error.message }

  return { message: "Password reset. Share the new temporary password." }
}

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

const updateClassroomSchema = z.object({
  id: uuidField(),
  name: z.string().trim().min(1, "Classroom name is required."),
  max_capacity: z.coerce.number().int().min(1).max(200),
})

/** Rename a classroom and/or change its capacity. */
export async function updateClassroomDetails(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  await requireRole("admin")
  const parsed = updateClassroomSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    max_capacity: formData.get("max_capacity"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const { id, name, max_capacity } = parsed.data
  const supabase = await createClient()
  const { error } = await supabase
    .from("classrooms")
    .update({ name, max_capacity })
    .eq("id", id)
  if (error) return { error: error.message }

  revalidatePath("/admin/classrooms")
  return { message: "Classroom updated." }
}

export async function deleteClassroom(classroomId: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase.from("classrooms").delete().eq("id", classroomId)
  revalidatePath("/admin/classrooms")
}

/** Move a child to a different classroom (or unassign) from the roster view. */
export async function moveChildClassroom(childId: string, classroomId: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase
    .from("children")
    .update({ classroom_id: classroomId === "none" ? null : classroomId })
    .eq("id", childId)
  revalidatePath("/admin/classrooms")
  revalidatePath("/admin/children")
}

// --- Parent linking ---------------------------------------------------------

const linkSchema = z.object({
  parent_id: uuidField("Choose a parent."),
  child_id: uuidField("Choose a child."),
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
