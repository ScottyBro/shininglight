"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"

export type BillingState = { error?: string; message?: string }

// --- Fee plans --------------------------------------------------------------

const feePlanSchema = z.object({
  name: z.string().trim().min(1, "Name is required."),
  amount: z.coerce.number().min(0, "Amount must be zero or more."),
  billing_cycle: z.enum(["monthly", "termly", "annual"]),
  description: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null)),
})

export async function createFeePlan(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  await requireRole("admin")
  const parsed = feePlanSchema.safeParse({
    name: formData.get("name"),
    amount: formData.get("amount"),
    billing_cycle: formData.get("billing_cycle"),
    description: formData.get("description") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("fee_plans").insert(parsed.data)
  if (error) return { error: error.message }

  revalidatePath("/admin/billing")
  return { message: "Fee plan created." }
}

export async function deleteFeePlan(id: string) {
  await requireRole("admin")
  const supabase = await createClient()
  await supabase.from("fee_plans").delete().eq("id", id)
  revalidatePath("/admin/billing")
}

// --- Invoice generation -----------------------------------------------------

const generateSchema = z.object({
  fee_plan_id: z.string().uuid("Choose a fee plan."),
  period_label: z.string().trim().min(1, "Enter a period label, e.g. 'Sep 2026'."),
  due_date: z.string().trim().min(1, "Choose a due date."),
  classroom_id: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v !== "all" ? v : null)),
})

export async function generateInvoices(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  await requireRole("admin")
  const parsed = generateSchema.safeParse({
    fee_plan_id: formData.get("fee_plan_id"),
    period_label: formData.get("period_label"),
    due_date: formData.get("due_date"),
    classroom_id: formData.get("classroom_id") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()

  const { data: plan } = await supabase
    .from("fee_plans")
    .select("id, amount")
    .eq("id", parsed.data.fee_plan_id)
    .single()
  if (!plan) return { error: "Fee plan not found." }

  let childQuery = supabase
    .from("children")
    .select("id")
    .eq("enrollment_status", "active")
  if (parsed.data.classroom_id) {
    childQuery = childQuery.eq("classroom_id", parsed.data.classroom_id)
  }
  const { data: children } = await childQuery
  const childIds = (children ?? []).map((c) => c.id)
  if (childIds.length === 0) {
    return { error: "No active children match that selection." }
  }

  // Skip children who already have an invoice for this exact period label.
  const { data: existing } = await supabase
    .from("invoices")
    .select("child_id")
    .eq("period_label", parsed.data.period_label)
    .in("child_id", childIds)
  const already = new Set((existing ?? []).map((i) => i.child_id))

  const toInsert = childIds
    .filter((id) => !already.has(id))
    .map((child_id) => ({
      child_id,
      fee_plan_id: plan.id,
      period_label: parsed.data.period_label,
      amount_due: plan.amount,
      due_date: parsed.data.due_date,
      status: "unpaid" as const,
    }))

  if (toInsert.length === 0) {
    return { message: "All matching children already have that invoice." }
  }

  const { error } = await supabase.from("invoices").insert(toInsert)
  if (error) return { error: error.message }

  revalidatePath("/admin/billing")
  return {
    message: `Generated ${toInsert.length} invoice${toInsert.length === 1 ? "" : "s"}${
      already.size ? ` (${already.size} skipped — already existed)` : ""
    }.`,
  }
}

// --- Payments ---------------------------------------------------------------

const paymentSchema = z.object({
  invoice_id: z.string().uuid(),
  child_id: z.string().uuid(),
  amount: z.coerce.number().positive("Enter an amount greater than zero."),
  method: z.enum(["cash", "ecocash", "bank_transfer", "other"]),
})

/** Recompute an invoice's status from the sum of its payments. */
async function refreshInvoiceStatus(
  supabase: Awaited<ReturnType<typeof createClient>>,
  invoiceId: string
) {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("amount_due")
    .eq("id", invoiceId)
    .single()
  if (!invoice) return

  const { data: payments } = await supabase
    .from("payments")
    .select("amount")
    .eq("invoice_id", invoiceId)
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0)

  const status =
    paid >= Number(invoice.amount_due) ? "paid" : paid > 0 ? "partial" : "unpaid"
  await supabase.from("invoices").update({ status }).eq("id", invoiceId)
}

export async function recordPayment(
  _prev: BillingState,
  formData: FormData
): Promise<BillingState> {
  const profile = await requireRole("admin")
  const parsed = paymentSchema.safeParse({
    invoice_id: formData.get("invoice_id"),
    child_id: formData.get("child_id"),
    amount: formData.get("amount"),
    method: formData.get("method"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.from("payments").insert({
    ...parsed.data,
    recorded_by: profile.id,
  })
  if (error) return { error: error.message }

  await refreshInvoiceStatus(supabase, parsed.data.invoice_id)

  revalidatePath("/admin/billing")
  revalidatePath("/parent/billing")
  return { message: "Payment recorded." }
}
