import { NextResponse } from "next/server"
import { PDFDocument, StandardFonts, rgb } from "pdf-lib"

import { createClient } from "@/lib/supabase/server"
import { currency } from "@/lib/format"
import { dateLabel } from "@/lib/date"

const METHOD_LABEL: Record<string, string> = {
  cash: "Cash",
  ecocash: "EcoCash",
  bank_transfer: "Bank transfer",
  other: "Other",
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ paymentId: string }> }
) {
  const { paymentId } = await params
  const supabase = await createClient()

  // RLS ensures only an admin or the child's parent can read this payment.
  const { data: payment } = await supabase
    .from("payments")
    .select(
      "id, amount, method, receipt_number, paid_at, child:children(full_name), invoice:invoices(period_label)"
    )
    .eq("id", paymentId)
    .maybeSingle()

  if (!payment) {
    return new NextResponse("Not found", { status: 404 })
  }

  const p = payment as unknown as {
    amount: number
    method: string
    receipt_number: string
    paid_at: string
    child: { full_name: string } | null
    invoice: { period_label: string } | null
  }

  const pdf = await PDFDocument.create()
  const page = pdf.addPage([420, 595]) // A5-ish portrait
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.13, 0.15, 0.18)
  const muted = rgb(0.42, 0.45, 0.5)
  const brand = rgb(0.17, 0.62, 0.65)

  const left = 40
  let y = 545

  const text = (
    s: string,
    x: number,
    yy: number,
    size = 11,
    f = font,
    color = ink
  ) => page.drawText(s, { x, y: yy, size, font: f, color })

  text("Shining Light Pre-School", left, y, 18, bold, brand)
  y -= 22
  text("Payment Receipt", left, y, 12, font, muted)

  y -= 30
  page.drawLine({
    start: { x: left, y },
    end: { x: 380, y },
    thickness: 1,
    color: rgb(0.9, 0.9, 0.92),
  })

  const row = (label: string, value: string) => {
    y -= 26
    text(label, left, y, 10, font, muted)
    text(value, left + 140, y, 12, bold)
  }

  row("Receipt no.", p.receipt_number)
  row("Date", dateLabel(p.paid_at))
  row("Child", p.child?.full_name ?? "—")
  row("For", p.invoice?.period_label ?? "General payment")
  row("Method", METHOD_LABEL[p.method] ?? p.method)

  y -= 34
  page.drawRectangle({
    x: left,
    y: y - 6,
    width: 340,
    height: 40,
    color: rgb(0.95, 0.98, 0.98),
  })
  text("Amount paid", left + 12, y + 12, 11, font, muted)
  text(currency(p.amount), left + 210, y + 8, 18, bold, brand)

  y -= 70
  text("Thank you for your payment.", left, y, 10, font, muted)
  text(
    "This is a computer-generated receipt.",
    left,
    y - 14,
    9,
    font,
    muted
  )

  const bytes = await pdf.save()
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="receipt-${p.receipt_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  })
}
