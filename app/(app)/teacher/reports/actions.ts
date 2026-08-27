"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { schoolToday } from "@/lib/date"
import type { Database } from "@/lib/types/database"

export type ReportState = { error?: string; message?: string }

const mealSchema = z.object({
  time: z.string().trim().optional().default(""),
  food: z.string().trim().optional().default(""),
  amount: z.enum(["none", "some", "most", "all"]).optional(),
})
const napSchema = z.object({
  start: z.string().trim().optional().default(""),
  end: z.string().trim().optional().default(""),
})
const bathroomSchema = z.object({
  time: z.string().trim().optional().default(""),
  type: z.enum(["wet", "bm", "dry", "potty"]).optional(),
})

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

async function uploadReportPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  files: FormDataEntryValue[]
): Promise<string[]> {
  const paths: string[] = []
  for (const f of files) {
    if (!(f instanceof File) || f.size === 0) continue
    const ext = f.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${childId}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from("report-photos")
      .upload(path, f, { contentType: f.type || undefined, upsert: true })
    if (!error) paths.push(path)
  }
  return paths
}

/**
 * Create or update today's daily report for a child. `intent` decides whether
 * it stays a draft or gets published to the family.
 */
export async function saveDailyReport(
  _prev: ReportState,
  formData: FormData
): Promise<ReportState> {
  const profile = await requireRole(["teacher", "admin"])

  const childId = formData.get("child_id")?.toString()
  if (!childId) return { error: "Missing child." }

  const intent = formData.get("intent")?.toString() === "publish" ? "publish" : "draft"
  const date = schoolToday()
  const supabase = await createClient()

  // Verify the teacher is allowed to report on this child (RLS also enforces).
  const meals = parseJsonArray(formData.get("meals"), mealSchema).filter(
    (m) => m.time || m.food || m.amount
  )
  const naps = parseJsonArray(formData.get("naps"), napSchema).filter(
    (n) => n.start || n.end
  )
  const bathroom = parseJsonArray(formData.get("bathroom"), bathroomSchema).filter(
    (b) => b.time || b.type
  )

  const existingPhotos = (() => {
    const raw = formData.get("existing_photos")
    if (typeof raw !== "string" || !raw.trim()) return [] as string[]
    try {
      const arr = JSON.parse(raw)
      return Array.isArray(arr) ? (arr as string[]) : []
    } catch {
      return []
    }
  })()

  const newPhotos = await uploadReportPhotos(
    supabase,
    childId,
    formData.getAll("photos")
  )

  const row: Database["public"]["Tables"]["daily_reports"]["Insert"] = {
    child_id: childId,
    date,
    meals,
    naps,
    bathroom,
    mood: formData.get("mood")?.toString().trim() || null,
    activities: formData.get("activities")?.toString().trim() || null,
    notes: formData.get("notes")?.toString().trim() || null,
    photos: [...existingPhotos, ...newPhotos],
    status: intent === "publish" ? "published" : "draft",
    ai_generated: formData.get("ai_generated")?.toString() === "true",
    created_by: profile.id,
    published_at: intent === "publish" ? new Date().toISOString() : null,
  }

  const { error } = await supabase
    .from("daily_reports")
    .upsert(row, { onConflict: "child_id,date" })

  if (error) return { error: error.message }

  revalidatePath("/teacher/reports")
  revalidatePath(`/teacher/reports/${childId}`)

  if (intent === "publish") {
    redirect("/teacher/reports")
  }
  return { message: "Draft saved." }
}
