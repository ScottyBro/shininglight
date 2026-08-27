"use server"

import { requireRole } from "@/lib/auth"
import { draftDailyReportSummary, type ReportInputs } from "@/lib/ai"

export type AiDraftState = { text?: string; error?: string }

/**
 * Generate a warm, parent-ready draft summary from the day's structured data.
 * Human-in-the-loop: the teacher reviews and edits before publishing, and the
 * report is flagged ai_generated. Only the child's first name and the day's
 * activity data are sent to the model — never medical or contact records.
 */
export async function draftReportSummary(
  input: ReportInputs
): Promise<AiDraftState> {
  await requireRole(["teacher", "admin"])
  try {
    const text = await draftDailyReportSummary(input)
    if (!text) return { error: "The draft came back empty. Try again." }
    return { text }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not reach the AI service."
    return { error: message }
  }
}
