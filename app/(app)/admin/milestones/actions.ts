"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { uuidField } from "@/lib/validation"

export type MilestoneFormState = { error?: string; message?: string }

const milestoneSchema = z.object({
  domain: z.enum(["motor", "cognitive", "language", "social"]),
  title: z.string().trim().min(2, "Enter a title."),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
  min_age_months: z.coerce.number().int().min(0).max(72),
  max_age_months: z.coerce.number().int().min(0).max(72),
})

export async function createMilestone(
  _prev: MilestoneFormState,
  formData: FormData
): Promise<MilestoneFormState> {
  await requireRole("admin")
  const parsed = milestoneSchema.safeParse({
    domain: formData.get("domain"),
    title: formData.get("title"),
    description: formData.get("description") ?? undefined,
    min_age_months: formData.get("min_age_months"),
    max_age_months: formData.get("max_age_months"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }
  if (parsed.data.max_age_months < parsed.data.min_age_months) {
    return { error: "Max age must be at or after min age." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("milestones").insert(parsed.data)
  if (error) return { error: error.message }

  revalidatePath("/admin/milestones")
  return { message: "Milestone added." }
}

const deleteSchema = z.object({ id: uuidField() })

export async function deleteMilestone(id: string) {
  await requireRole("admin")
  const parsed = deleteSchema.safeParse({ id })
  if (!parsed.success) return
  const supabase = await createClient()
  await supabase.from("milestones").delete().eq("id", parsed.data.id)
  revalidatePath("/admin/milestones")
}
