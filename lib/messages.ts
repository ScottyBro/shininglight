"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireProfile } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { draftMessage, translateText } from "@/lib/ai"
import { uuidField } from "@/lib/validation"

export type MessageState = { error?: string; ok?: number }

const schema = z.object({
  child_id: uuidField(),
  body: z.string().trim().min(1, "Write a message first.").max(4000),
})

/** Send a message on a child's thread. Sender must be a participant (RLS). */
export async function sendMessage(
  prev: MessageState,
  formData: FormData
): Promise<MessageState> {
  const profile = await requireProfile()
  const parsed = schema.safeParse({
    child_id: formData.get("child_id"),
    body: formData.get("body"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid message." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("messages").insert({
    child_id: parsed.data.child_id,
    sender_id: profile.id,
    body: parsed.data.body,
  })
  if (error) return { error: error.message }

  revalidatePath("/parent/messages")
  revalidatePath("/teacher/messages")
  revalidatePath(`/teacher/messages/${parsed.data.child_id}`)
  return { ok: (prev.ok ?? 0) + 1 }
}

export type AiTextState = { text?: string; error?: string }

/** AI: draft a parent message from a short intent (staff-facing helper). */
export async function draftMessageText(
  intent: string,
  childFirstName?: string
): Promise<AiTextState> {
  await requireProfile()
  if (!intent.trim()) return { error: "Type a few words about what to say." }
  try {
    return { text: await draftMessage(intent, childFirstName) }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not reach the AI service.",
    }
  }
}

/** AI: translate text into a family's preferred language (en/sn/nd). */
export async function translateMessageText(
  text: string,
  language: string
): Promise<AiTextState> {
  await requireProfile()
  if (!text.trim()) return { error: "Nothing to translate yet." }
  try {
    return { text: await translateText(text, language) }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Could not reach the AI service.",
    }
  }
}

/**
 * Mark all messages on a child's thread that the current user didn't send as
 * read. Meant to be invoked client-side (see components/messages/mark-read.tsx)
 * rather than awaited during a page's render: calling it as a genuine action
 * lets `revalidatePath` refresh the shared (app) layout's unread badge, which
 * a plain awaited call during a Server Component's render would not do —
 * layouts persist across sibling navigations and don't re-run on their own.
 */
export async function markThreadRead(childId: string) {
  const profile = await requireProfile()
  const supabase = await createClient()
  await supabase
    .from("messages")
    .update({ read_at: new Date().toISOString() })
    .eq("child_id", childId)
    .is("read_at", null)
    .neq("sender_id", profile.id)

  revalidatePath(profile.role === "parent" ? "/parent" : "/teacher", "layout")
}
