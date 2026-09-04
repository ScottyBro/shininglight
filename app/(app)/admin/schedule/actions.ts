"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { uuidField } from "@/lib/validation"

export type ScheduleState = { error?: string; message?: string }

const shiftSchema = z
  .object({
    teacher_id: uuidField("Choose a teacher."),
    classroom_id: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v && v !== "none" ? v : null)),
    date: z.string().trim().min(1, "Choose a date."),
    start_time: z.string().trim().min(1, "Choose a start time."),
    end_time: z.string().trim().min(1, "Choose an end time."),
    notes: z
      .string()
      .trim()
      .optional()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => v.end_time > v.start_time, {
    message: "End time must be after the start time.",
    path: ["end_time"],
  })

export async function createShift(
  _prev: ScheduleState,
  formData: FormData
): Promise<ScheduleState> {
  const profile = await requireRole("admin")
  const parsed = shiftSchema.safeParse({
    teacher_id: formData.get("teacher_id"),
    classroom_id: formData.get("classroom_id") ?? undefined,
    date: formData.get("date"),
    start_time: formData.get("start_time"),
    end_time: formData.get("end_time"),
    notes: formData.get("notes") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from("shifts")
    .insert({ ...parsed.data, created_by: profile.id })
  if (error) return { error: error.message }

  revalidatePath("/admin/schedule")
  return { message: "Shift added." }
}

export async function deleteShift(shiftId: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase.from("shifts").delete().eq("id", shiftId)
  revalidatePath("/admin/schedule")
}
