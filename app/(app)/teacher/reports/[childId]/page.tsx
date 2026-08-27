import Link from "next/link"
import { notFound } from "next/navigation"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { signedUrl } from "@/lib/storage"
import { schoolToday, dateLabel } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { ChildSafetyBadges } from "@/components/child-badges"
import { DailyReportForm } from "@/components/teacher/daily-report-form"
import { Badge } from "@/components/ui/badge"
import type { DailyReport } from "@/lib/types/database"

export const metadata = { title: "Daily report" }

export default async function ReportEditorPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  await requireRole(["teacher", "admin"])
  const { childId } = await params
  const supabase = await createClient()
  const date = schoolToday()

  const { data: child } = await supabase
    .from("children")
    .select("id, full_name, allergies, medical_notes")
    .eq("id", childId)
    .single()

  if (!child) notFound()

  const { data: report } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("child_id", childId)
    .eq("date", date)
    .maybeSingle()

  const existing = report as DailyReport | null

  const existingPhotos = await Promise.all(
    (existing?.photos ?? []).map(async (path) => ({
      path,
      url: await signedUrl("report-photos", path),
    }))
  )

  return (
    <>
      <PageHeader
        title={child.full_name}
        description={`Daily report · ${dateLabel(date)}`}
        action={
          existing?.status === "published" ? (
            <Badge>Published</Badge>
          ) : existing?.status === "draft" ? (
            <Badge variant="secondary">Draft</Badge>
          ) : null
        }
      />

      <div className="mb-4">
        <ChildSafetyBadges
          allergies={child.allergies}
          medicalNotes={child.medical_notes}
        />
      </div>

      <DailyReportForm
        childId={child.id}
        firstName={child.full_name.split(" ")[0]}
        report={existing}
        existingPhotos={existingPhotos}
      />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/teacher/reports" className="hover:underline">
          ← Back to reports
        </Link>
      </p>
    </>
  )
}
