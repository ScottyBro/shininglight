import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { MilestoneLibrary } from "@/components/admin/milestone-library"
import type { Milestone } from "@/lib/types/database"

export const metadata = { title: "Milestones" }

export default async function AdminMilestonesPage() {
  await requireRole("admin")
  const supabase = await createClient()
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .order("domain")
    .order("sort_order")

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Curate the developmental milestone library teachers track."
      />
      <MilestoneLibrary milestones={(milestones ?? []) as Milestone[]} />
    </>
  )
}
