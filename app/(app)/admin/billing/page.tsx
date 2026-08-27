import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { schoolToday } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { BillingTabs } from "@/components/admin/billing-tabs"
import type { InvoiceRow, PaymentRow } from "@/components/admin/billing-tabs"

export const metadata = { title: "Billing" }

export default async function AdminBillingPage() {
  await requireRole("admin")
  const supabase = await createClient()

  const [
    { data: feePlans },
    { data: classrooms },
    { data: invoices },
    { data: payments },
    { data: balances },
    { data: children },
  ] = await Promise.all([
    supabase.from("fee_plans").select("*").order("name"),
    supabase.from("classrooms").select("id, name").order("name"),
    supabase
      .from("invoices")
      .select(
        "id, child_id, period_label, amount_due, due_date, status, issued_at, child:children(full_name)"
      )
      .order("issued_at", { ascending: false }),
    supabase
      .from("payments")
      .select(
        "id, invoice_id, amount, method, receipt_number, paid_at, child:children(full_name), invoice:invoices(period_label)"
      )
      .order("paid_at", { ascending: false }),
    supabase.from("child_balances").select("child_id, total_invoiced, total_paid, balance"),
    supabase.from("children").select("id, full_name").order("full_name"),
  ])

  const paidByInvoice = new Map<string, number>()
  for (const p of payments ?? []) {
    if (!p.invoice_id) continue
    paidByInvoice.set(
      p.invoice_id,
      (paidByInvoice.get(p.invoice_id) ?? 0) + Number(p.amount)
    )
  }

  const paymentRows = (payments ?? []).map((p) => {
    const child = p.child as unknown as { full_name: string } | null
    const invoice = p.invoice as unknown as { period_label: string } | null
    return {
      id: p.id,
      receipt_number: p.receipt_number,
      amount: Number(p.amount),
      method: p.method,
      paid_at: p.paid_at,
      child_name: child?.full_name ?? "—",
      period_label: invoice?.period_label ?? null,
    }
  })

  const today = schoolToday()
  const invoiceRows: InvoiceRow[] = (invoices ?? []).map((inv) => {
    const paid = paidByInvoice.get(inv.id) ?? 0
    const child = inv.child as unknown as { full_name: string } | null
    const isOverdue =
      inv.status !== "paid" && inv.due_date < today
    return {
      id: inv.id,
      child_id: inv.child_id,
      child_name: child?.full_name ?? "—",
      period_label: inv.period_label,
      amount_due: Number(inv.amount_due),
      paid,
      due_date: inv.due_date,
      status: inv.status,
      overdue: isOverdue,
    }
  })

  const nameById = new Map(
    (children ?? []).map((c) => [c.id, c.full_name])
  )
  const balanceRows = (balances ?? [])
    .map((b) => ({
      child_id: b.child_id,
      child_name: nameById.get(b.child_id) ?? "—",
      total_invoiced: Number(b.total_invoiced),
      total_paid: Number(b.total_paid),
      balance: Number(b.balance),
    }))
    .sort((a, b) => b.balance - a.balance)

  const outstanding = balanceRows.reduce((s, b) => s + Math.max(b.balance, 0), 0)

  return (
    <>
      <PageHeader
        title="Billing"
        description="Fee plans, invoices, payments and receipts."
      />
      <BillingTabs
        feePlans={feePlans ?? []}
        classrooms={classrooms ?? []}
        invoices={invoiceRows}
        payments={paymentRows as PaymentRow[]}
        balances={balanceRows}
        outstanding={outstanding}
      />
    </>
  )
}
