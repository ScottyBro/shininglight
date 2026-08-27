import "server-only"

import Anthropic from "@anthropic-ai/sdk"

import { serverEnv } from "@/lib/env"

/**
 * Server-only Claude helpers. The API key and model are read from server env
 * (model is configurable via ANTHROPIC_MODEL). Never import this into a Client
 * Component.
 */

let client: Anthropic | null = null
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: serverEnv.anthropicApiKey })
  return client
}

async function complete(
  system: string,
  user: string,
  maxTokens = 1024
): Promise<string> {
  const msg = await getClient().messages.create({
    model: serverEnv.anthropicModel,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: user }],
  })
  return msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n")
    .trim()
}

export type ReportInputs = {
  firstName: string
  meals: { time?: string; food?: string; amount?: string }[]
  naps: { start?: string; end?: string }[]
  bathroom: { time?: string; type?: string }[]
  mood?: string | null
  activities?: string | null
  note?: string | null
}

/**
 * Draft a warm, parent-ready daily summary from that day's structured data
 * only. Deliberately receives the child's FIRST NAME plus the day's activity
 * data — never medical, allergy, or contact records.
 */
export async function draftDailyReportSummary(
  input: ReportInputs
): Promise<string> {
  const system =
    "You write short, warm daily updates for a preschool, addressed to a child's parents. " +
    "Use a friendly, reassuring tone. 2–4 short sentences. Refer to the child by their first name. " +
    "Only use the facts provided — do not invent details. Do not mention allergies, medical notes, or contacts. " +
    "Return plain text only, no headings or bullet points."

  const facts = JSON.stringify(
    {
      first_name: input.firstName,
      meals: input.meals,
      naps: input.naps,
      bathroom: input.bathroom,
      mood: input.mood ?? undefined,
      activities: input.activities ?? undefined,
      teacher_note: input.note ?? undefined,
    },
    null,
    2
  )

  return complete(
    system,
    `Write the update from this day's data:\n\n${facts}`,
    500
  )
}

const LANGUAGE_LABEL: Record<string, string> = {
  en: "English",
  sn: "Shona",
  nd: "Ndebele",
}

/** Translate text into the family's preferred language (en/sn/nd). */
export async function translateText(
  text: string,
  language: string
): Promise<string> {
  const target = LANGUAGE_LABEL[language] ?? language
  if (target === "English" && language === "en") return text
  const system =
    `You are a translator. Translate the user's message into ${target}. ` +
    "Preserve tone and meaning. Return only the translation, with no notes or preamble."
  return complete(system, text, 700)
}

/** Help staff draft a parent message from a short intent. */
export async function draftMessage(
  intent: string,
  childFirstName?: string
): Promise<string> {
  const system =
    "You help preschool staff write brief, warm, professional messages to a parent. " +
    "Keep it to 1–3 sentences, friendly and clear. Return only the message text." +
    (childFirstName ? ` The child's first name is ${childFirstName}.` : "")
  return complete(system, `Draft a message about: ${intent}`, 400)
}
