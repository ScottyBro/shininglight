import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { ageLabel } from "@/lib/format"
import { PageHeader } from "@/components/page-header"
import { MilestoneTracker } from "@/components/teacher/milestone-tracker"
import type { Milestone, MilestoneStatus } from "@/lib/types/database"

export const metadata = { title: "Milestones" }

export default async function ChildMilestonesPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  await requireRole(["teacher", "admin"])
  const { childId } = await params
  const supabase = await createClient()

  const [{ data: child }, { data: milestones }, { data: progress }] =
    await Promise.all([
      supabase
        .from("children")
        .select("id, full_name, date_of_birth")
        .eq("id", childId)
        .single(),
      supabase.from("milestones").select("*").order("domain").order("sort_order"),
      supabase
        .from("child_milestones")
        .select("milestone_id, status, notes")
        .eq("child_id", childId),
    ])

  if (!child) notFound()

  const progressByMilestone: Record<
    string,
    { status: MilestoneStatus; notes: string | null }
  > = Object.fromEntries(
    (progress ?? []).map((p) => [
      p.milestone_id,
      { status: p.status as MilestoneStatus, notes: p.notes },
    ])
  )

  return (
    <>
      <PageHeader
        title={child.full_name}
        description={
          [ageLabel(child.date_of_birth), "Developmental milestones"]
            .filter(Boolean)
            .join(" · ")
        }
      />
      <Link
        href="/teacher/milestones"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All children
      </Link>

      <MilestoneTracker
        childId={child.id}
        milestones={(milestones ?? []) as Milestone[]}
        progress={progressByMilestone}
      />
    </>
  )
}
