import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getParentChildren } from "@/lib/parent"
import { currency } from "@/lib/format"
import { dateLabel, schoolToday } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export const metadata = { title: "Billing" }

export default async function ParentBillingPage() {
  const profile = await requireRole("parent")
  const children = await getParentChildren(profile.id)
  const supabase = await createClient()
  const ids = children.map((c) => c.id)
  const today = schoolToday()

  const [{ data: balances }, { data: invoices }, { data: payments }] = ids.length
    ? await Promise.all([
        supabase
          .from("child_balances")
          .select("child_id, total_invoiced, total_paid, balance")
          .in("child_id", ids),
        supabase
          .from("invoices")
          .select("id, child_id, period_label, amount_due, due_date, status")
          .in("child_id", ids)
          .order("due_date", { ascending: false }),
        supabase
          .from("payments")
          .select("id, child_id, amount, receipt_number, paid_at")
          .in("child_id", ids)
          .order("paid_at", { ascending: false }),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }]

  const balanceByChild = new Map(
    (balances ?? []).map((b) => [b.child_id, Number(b.balance)])
  )

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your invoices, balance and receipts."
      />

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nothing to show yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {children.map((child) => {
            const childInvoices = (invoices ?? []).filter(
              (i) => i.child_id === child.id
            )
            const childPayments = (payments ?? []).filter(
              (p) => p.child_id === child.id
            )
            const balance = balanceByChild.get(child.id) ?? 0

            return (
              <div key={child.id} className="grid gap-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{child.full_name}</h2>
                  <div className="text-right">
                    <div className="text-xs text-muted-foreground">Balance</div>
                    <div
                      className={
                        balance > 0
                          ? "text-lg font-bold text-destructive"
                          : "text-lg font-bold"
                      }
                    >
                      {currency(balance)}
                    </div>
                  </div>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Invoices</CardTitle>
                  </CardHeader>
                  <CardContent className="grid gap-2 text-sm">
                    {childInvoices.length === 0 ? (
                      <p className="text-muted-foreground">No invoices.</p>
                    ) : (
                      childInvoices.map((inv) => {
                        const overdue =
                          inv.status !== "paid" && inv.due_date < today
                        return (
                          <div
                            key={inv.id}
                            className="flex items-center justify-between gap-2 border-b pb-2 last:border-0 last:pb-0"
                          >
                            <div>
                              <div className="font-medium">{inv.period_label}</div>
                              <div className="text-xs text-muted-foreground">
                                Due {dateLabel(inv.due_date)}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>{currency(inv.amount_due)}</span>
                              {inv.status === "paid" ? (
                                <Badge>Paid</Badge>
                              ) : overdue ? (
                                <Badge variant="destructive">Overdue</Badge>
                              ) : inv.status === "partial" ? (
                                <Badge variant="secondary">Partial</Badge>
                              ) : (
                                <Badge variant="outline">Unpaid</Badge>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </CardContent>
                </Card>

                {childPayments.length > 0 ? (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Receipts</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-2 text-sm">
                      {childPayments.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2"
                        >
                          <div>
                            <span className="font-mono text-xs">
                              {p.receipt_number}
                            </span>
                            <span className="ml-2 text-muted-foreground">
                              {dateLabel(p.paid_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span>{currency(p.amount)}</span>
                            <Button asChild variant="outline" size="sm">
                              <a
                                href={`/api/receipts/${p.id}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="size-4" /> PDF
                              </a>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
