import { Check, CircleDashed, Circle } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { getParentChildren } from "@/lib/parent"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  Milestone,
  MilestoneDomain,
  MilestoneStatus,
} from "@/lib/types/database"

export const metadata = { title: "Milestones" }

const DOMAIN_LABEL: Record<MilestoneDomain, string> = {
  motor: "Motor",
  cognitive: "Cognitive",
  language: "Language",
  social: "Social / emotional",
}

export default async function ParentMilestonesPage() {
  const profile = await requireRole("parent")
  const children = await getParentChildren(profile.id)
  const supabase = await createClient()

  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .order("domain")
    .order("sort_order")

  const childData = await Promise.all(
    children.map(async (child) => {
      const { data: progress } = await supabase
        .from("child_milestones")
        .select("milestone_id, status")
        .eq("child_id", child.id)
      return {
        child,
        progressByMilestone: new Map(
          (progress ?? []).map((p) => [p.milestone_id, p.status as MilestoneStatus])
        ),
      }
    })
  )

  return (
    <>
      <PageHeader
        title="Milestones"
        description="Your child's developmental progress, as tracked by their teacher."
      />

      {children.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nothing to show yet.
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue={children[0].id}>
          {children.length > 1 ? (
            <TabsList>
              {children.map((c) => (
                <TabsTrigger key={c.id} value={c.id}>
                  {c.full_name.split(" ")[0]}
                </TabsTrigger>
              ))}
            </TabsList>
          ) : null}
          {childData.map(({ child, progressByMilestone }) => (
            <TabsContent key={child.id} value={child.id} className="mt-4 grid gap-4">
              <MilestoneGroups
                milestones={(milestones ?? []) as Milestone[]}
                progressByMilestone={progressByMilestone}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}

function MilestoneGroups({
  milestones,
  progressByMilestone,
}: {
  milestones: Milestone[]
  progressByMilestone: Map<string, MilestoneStatus>
}) {
  const byDomain = new Map<MilestoneDomain, Milestone[]>()
  for (const m of milestones) {
    const list = byDomain.get(m.domain) ?? []
    list.push(m)
    byDomain.set(m.domain, list)
  }

  return (
    <>
      {(Object.keys(DOMAIN_LABEL) as MilestoneDomain[]).map((domain) => {
        const list = byDomain.get(domain) ?? []
        if (list.length === 0) return null
        return (
          <Card key={domain}>
            <CardHeader>
              <CardTitle className="text-base">{DOMAIN_LABEL[domain]}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {list.map((m) => {
                const status = progressByMilestone.get(m.id) ?? "not_started"
                return (
                  <div key={m.id} className="flex items-center gap-2.5 text-sm">
                    {status === "achieved" ? (
                      <Check className="size-4 shrink-0 text-primary" />
                    ) : status === "in_progress" ? (
                      <CircleDashed className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground/40" />
                    )}
                    <span
                      className={
                        status === "achieved"
                          ? "font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {m.title}
                    </span>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}
    </>
  )
}
