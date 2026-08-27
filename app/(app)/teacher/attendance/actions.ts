"use server"

import { revalidatePath } from "next/cache"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { schoolToday } from "@/lib/date"

/**
 * One-tap check-in. Records the timestamp and the staff member who did it.
 * Idempotent per (child, day): re-tapping does not overwrite an existing
 * check-in time.
 */
export async function checkIn(childId: string) {
  const profile = await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const date = schoolToday()

  const { data: existing } = await supabase
    .from("attendance")
    .select("id, check_in_at")
    .eq("child_id", childId)
    .eq("date", date)
    .maybeSingle()

  if (existing?.check_in_at) {
    revalidatePath("/teacher/attendance")
    return
  }

  const now = new Date().toISOString()
  if (existing) {
    await supabase
      .from("attendance")
      .update({ check_in_at: now, check_in_by: profile.id })
      .eq("id", existing.id)
  } else {
    await supabase.from("attendance").insert({
      child_id: childId,
      date,
      check_in_at: now,
      check_in_by: profile.id,
    })
  }
  revalidatePath("/teacher/attendance")
}

/** One-tap check-out. Records the timestamp and the staff member. */
export async function checkOut(childId: string) {
  const profile = await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const date = schoolToday()
  const now = new Date().toISOString()

  await supabase
    .from("attendance")
    .upsert(
      {
        child_id: childId,
        date,
        check_out_at: now,
        check_out_by: profile.id,
      },
      { onConflict: "child_id,date" }
    )
  revalidatePath("/teacher/attendance")
}

/** Undo a check-out (correct an accidental tap). */
export async function undoCheckOut(childId: string) {
  await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const date = schoolToday()
  await supabase
    .from("attendance")
    .update({ check_out_at: null, check_out_by: null })
    .eq("child_id", childId)
    .eq("date", date)
  revalidatePath("/teacher/attendance")
}

/** Undo a check-in (removes the attendance record for today). */
export async function undoCheckIn(childId: string) {
  await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const date = schoolToday()
  await supabase
    .from("attendance")
    .delete()
    .eq("child_id", childId)
    .eq("date", date)
  revalidatePath("/teacher/attendance")
}
