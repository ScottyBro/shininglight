"use client"

import { useActionState, useEffect, useState } from "react"
import { Download, Trash2 } from "lucide-react"

import {
  createFeePlan,
  deleteFeePlan,
  generateInvoices,
  recordPayment,
  type BillingState,
} from "@/app/(app)/admin/billing/actions"
import { currency } from "@/lib/format"
import { dateLabel } from "@/lib/date"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FeePlan, InvoiceStatus } from "@/lib/types/database"

export type InvoiceRow = {
  id: string
  child_id: string
  child_name: string
  period_label: string
  amount_due: number
  paid: number
  due_date: string
  status: InvoiceStatus
  overdue: boolean
}

export type PaymentRow = {
  id: string
  receipt_number: string
  amount: number
  method: string
  paid_at: string
  child_name: string
  period_label: string | null
}

type Balance = {
  child_id: string
  child_name: string
  total_invoiced: number
  total_paid: number
  balance: number
}

const initial: BillingState = {}
const CYCLE_LABEL = { monthly: "Monthly", termly: "Termly", annual: "Annual" }

export function BillingTabs({
  feePlans,
  classrooms,
  invoices,
  payments,
  balances,
  outstanding,
}: {
  feePlans: FeePlan[]
  classrooms: { id: string; name: string }[]
  invoices: InvoiceRow[]
  payments: PaymentRow[]
  balances: Balance[]
  outstanding: number
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="plans">Fee plans</TabsTrigger>
      </TabsList>

      {/* Overview */}
      <TabsContent value="overview" className="mt-4 grid gap-4">
        <Card>
          <CardHeader className="pb-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total outstanding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold">{currency(outstanding)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balances by child</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead className="text-right">Invoiced</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {balances.map((b) => (
                  <TableRow key={b.child_id}>
                    <TableCell className="font-medium">{b.child_name}</TableCell>
                    <TableCell className="text-right">
                      {currency(b.total_invoiced)}
                    </TableCell>
                    <TableCell className="text-right">
                      {currency(b.total_paid)}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={b.balance > 0 ? "text-destructive" : ""}>
                        {currency(b.balance)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
                {balances.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No children yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Invoices */}
      <TabsContent value="invoices" className="mt-4 grid gap-4">
        <GenerateInvoices feePlans={feePlans} classrooms={classrooms} />
        <Card>
          <CardHeader>
            <CardTitle>Invoices</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Child</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Due</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.child_name}</TableCell>
                    <TableCell>{inv.period_label}</TableCell>
                    <TableCell className="text-right">
                      {currency(inv.amount_due)}
                    </TableCell>
                    <TableCell className="text-right">{currency(inv.paid)}</TableCell>
                    <TableCell>
                      <InvoiceStatusBadge inv={inv} />
                    </TableCell>
                    <TableCell className="text-right">
                      {inv.status !== "paid" ? (
                        <RecordPaymentDialog inv={inv} />
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
                {invoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No invoices yet. Generate some above.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Payments */}
      <TabsContent value="payments" className="mt-4">
        <Card>
          <CardHeader>
            <CardTitle>Payments &amp; receipts</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Receipt</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Child</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-mono text-xs">
                      {p.receipt_number}
                    </TableCell>
                    <TableCell>{dateLabel(p.paid_at)}</TableCell>
                    <TableCell className="font-medium">{p.child_name}</TableCell>
                    <TableCell className="text-right">{currency(p.amount)}</TableCell>
                    <TableCell className="text-right">
                      <Button asChild variant="outline" size="sm">
                        <a href={`/api/receipts/${p.id}`} target="_blank" rel="noreferrer">
                          <Download className="size-4" /> Receipt
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {payments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      No payments recorded yet.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Fee plans */}
      <TabsContent value="plans" className="mt-4 grid gap-4">
        <FeePlanForm />
        <div className="grid gap-3 sm:grid-cols-2">
          {feePlans.map((plan) => (
            <Card key={plan.id}>
              <CardHeader className="flex-row items-start justify-between">
                <div>
                  <CardTitle>{plan.name}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {currency(plan.amount)} ·{" "}
                    {CYCLE_LABEL[plan.billing_cycle]}
                  </p>
                </div>
                <form action={deleteFeePlan.bind(null, plan.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete fee plan"
                    className="text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </form>
              </CardHeader>
              {plan.description ? (
                <CardContent className="text-sm text-muted-foreground">
                  {plan.description}
                </CardContent>
              ) : null}
            </Card>
          ))}
          {feePlans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No fee plans yet.</p>
          ) : null}
        </div>
      </TabsContent>
    </Tabs>
  )
}

function InvoiceStatusBadge({ inv }: { inv: InvoiceRow }) {
  if (inv.status === "paid") return <Badge>Paid</Badge>
  if (inv.overdue) return <Badge variant="destructive">Overdue</Badge>
  if (inv.status === "partial") return <Badge variant="secondary">Partial</Badge>
  return <Badge variant="outline">Unpaid</Badge>
}

function GenerateInvoices({
  feePlans,
  classrooms,
}: {
  feePlans: FeePlan[]
  classrooms: { id: string; name: string }[]
}) {
  const [state, action, pending] = useActionState(generateInvoices, initial)
  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate invoices</CardTitle>
      </CardHeader>
      <CardContent>
        {feePlans.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Create a fee plan first (Fee plans tab).
          </p>
        ) : (
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="fee_plan_id">Fee plan</Label>
              <Select name="fee_plan_id">
                <SelectTrigger id="fee_plan_id" className="w-full">
                  <SelectValue placeholder="Choose a plan" />
                </SelectTrigger>
                <SelectContent>
                  {feePlans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {currency(p.amount)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="classroom_id">For</Label>
              <Select name="classroom_id" defaultValue="all">
                <SelectTrigger id="classroom_id" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All active children</SelectItem>
                  {classrooms.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="period_label">Period label</Label>
              <Input
                id="period_label"
                name="period_label"
                placeholder="Sep 2026"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="due_date">Due date</Label>
              <Input id="due_date" name="due_date" type="date" required />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Generating…" : "Generate invoices"}
              </Button>
            </div>
            <Feedback state={state} className="sm:col-span-2" />
          </form>
        )}
      </CardContent>
    </Card>
  )
}

function FeePlanForm() {
  const [state, action, pending] = useActionState(createFeePlan, initial)
  return (
    <Card>
      <CardHeader>
        <CardTitle>New fee plan</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Full day" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (USD)</Label>
            <Input
              id="amount"
              name="amount"
              type="number"
              min={0}
              step="0.01"
              placeholder="180"
              required
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="billing_cycle">Cycle</Label>
            <Select name="billing_cycle" defaultValue="monthly">
              <SelectTrigger id="billing_cycle" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="termly">Termly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Input id="description" name="description" placeholder="8am–4pm" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Create fee plan"}
            </Button>
          </div>
          <Feedback state={state} className="sm:col-span-2" />
        </form>
      </CardContent>
    </Card>
  )
}

function RecordPaymentDialog({ inv }: { inv: InvoiceRow }) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(recordPayment, initial)
  const balance = Math.max(inv.amount_due - inv.paid, 0)

  useEffect(() => {
    if (state.message) setOpen(false)
  }, [state.message])

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        Record payment
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
            <DialogDescription>
              {inv.child_name} · {inv.period_label} · balance {currency(balance)}
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-3">
            <input type="hidden" name="invoice_id" value={inv.id} />
            <input type="hidden" name="child_id" value={inv.child_id} />
            <div className="grid gap-2">
              <Label htmlFor={`amount-${inv.id}`}>Amount (USD)</Label>
              <Input
                id={`amount-${inv.id}`}
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={balance || ""}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor={`method-${inv.id}`}>Method</Label>
              <Select name="method" defaultValue="cash">
                <SelectTrigger id={`method-${inv.id}`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="ecocash">EcoCash</SelectItem>
                  <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Feedback state={state} />
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save payment"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Feedback({
  state,
  className,
}: {
  state: BillingState
  className?: string
}) {
  if (!state.error && !state.message) return null
  return (
    <div className={className}>
      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : (
        <p className="text-sm text-primary" role="status">
          {state.message}
        </p>
      )}
    </div>
  )
}
