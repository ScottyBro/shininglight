"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { uuidField } from "@/lib/validation"

export type MilestoneUpdateState = { error?: string }

const schema = z.object({
  child_id: uuidField(),
  milestone_id: uuidField(),
  status: z.enum(["not_started", "in_progress", "achieved"]),
  notes: z
    .string()
    .trim()
    .max(2000)
    .nullish()
    .transform((v) => (v ? v : null)),
})

/** Record/update a child's progress on one milestone. */
export async function setMilestoneStatus(
  input: z.infer<typeof schema>
): Promise<MilestoneUpdateState> {
  const profile = await requireRole(["teacher", "admin"])
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("child_milestones").upsert(
    {
      child_id: parsed.data.child_id,
      milestone_id: parsed.data.milestone_id,
      status: parsed.data.status,
      notes: parsed.data.notes,
      achieved_at: parsed.data.status === "achieved" ? new Date().toISOString() : null,
      recorded_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "child_id,milestone_id" }
  )
  if (error) return { error: error.message }

  revalidatePath(`/teacher/milestones/${parsed.data.child_id}`)
  revalidatePath("/parent/milestones")
  return {}
}
