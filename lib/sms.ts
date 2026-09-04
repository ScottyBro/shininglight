import "server-only"

import type { createClient } from "@/lib/supabase/server"

export type SmsResult = { ok: boolean; error?: string; simulated?: boolean }

/**
 * Provider-agnostic SMS sender for parents without reliable app/data access.
 *
 * Disconnected by design until real credentials are supplied: every call is
 * logged server-side and reported as "simulated" rather than actually sent,
 * so the rest of the app (opt-in preference, triggers on published reports
 * and new messages) can be built and tested without a live SMS bill.
 *
 * To go live:
 *   - Africa's Talking: set SMS_PROVIDER=africastalking,
 *     AFRICASTALKING_API_KEY, AFRICASTALKING_USERNAME, then replace the stub
 *     branch below with a call to https://api.africastalking.com/version1/messaging.
 *   - Twilio: set SMS_PROVIDER=twilio, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *     TWILIO_FROM_NUMBER, then call the Twilio Messages API instead.
 * Nothing else in the app needs to change — every call site just imports
 * `sendSms` from here.
 */
export async function sendSms(to: string | null | undefined, body: string): Promise<SmsResult> {
  if (!to) return { ok: false, error: "No phone number on file." }

  const provider = process.env.SMS_PROVIDER
  if (!provider) {
    console.log(`[sms:stub] would send to ${to}: ${body}`)
    return { ok: true, simulated: true }
  }

  // A provider name is set but not yet wired up — still simulate rather than
  // silently drop the message or throw, so callers don't need special-casing.
  console.log(`[sms:${provider}] provider not implemented yet — to ${to}: ${body}`)
  return { ok: true, simulated: true }
}

/**
 * Text every linked parent of `childId` who has opted in to SMS notifications
 * and has a phone number on file. Best-effort — failures are logged, never
 * thrown, so a notification hiccup can't block the report/message save that
 * triggered it.
 */
export async function notifyChildParentsBySms(
  supabase: Awaited<ReturnType<typeof createClient>>,
  childId: string,
  body: string
): Promise<void> {
  const { data: links } = await supabase
    .from("parent_children")
    .select("parent:profiles(phone, sms_opt_in)")
    .eq("child_id", childId)

  const parents = (links ?? []) as unknown as Array<{
    parent: { phone: string | null; sms_opt_in: boolean } | null
  }>

  for (const link of parents) {
    if (!link.parent?.sms_opt_in) continue
    try {
      await sendSms(link.parent.phone, body)
    } catch (err) {
      console.error("[sms] notify failed", err)
    }
  }
}
