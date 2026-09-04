"use client"

import { useState, useTransition } from "react"
import { Check, CircleDashed, Loader2 } from "lucide-react"

import { setMilestoneStatus } from "@/app/(app)/teacher/milestones/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Milestone, MilestoneDomain, MilestoneStatus } from "@/lib/types/database"

const DOMAIN_LABEL: Record<MilestoneDomain, string> = {
  motor: "Motor",
  cognitive: "Cognitive",
  language: "Language",
  social: "Social / emotional",
}

const STATUS_ORDER: MilestoneStatus[] = ["not_started", "in_progress", "achieved"]
const STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  achieved: "Achieved",
}

type Progress = { status: MilestoneStatus; notes: string | null }

export function MilestoneTracker({
  childId,
  milestones,
  progress,
}: {
  childId: string
  milestones: Milestone[]
  progress: Record<string, Progress>
}) {
  const byDomain = new Map<MilestoneDomain, Milestone[]>()
  for (const m of milestones) {
    const list = byDomain.get(m.domain) ?? []
    list.push(m)
    byDomain.set(m.domain, list)
  }

  return (
    <div className="grid gap-4">
      {(Object.keys(DOMAIN_LABEL) as MilestoneDomain[]).map((domain) => {
        const list = byDomain.get(domain) ?? []
        if (list.length === 0) return null
        return (
          <Card key={domain}>
            <CardHeader>
              <CardTitle>{DOMAIN_LABEL[domain]}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {list.map((m) => (
                <MilestoneRow
                  key={m.id}
                  childId={childId}
                  milestone={m}
                  current={progress[m.id]?.status ?? "not_started"}
                />
              ))}
            </CardContent>
          </Card>
        )
      })}
      {milestones.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No milestones defined yet. An admin can add some from Admin →
            Milestones.
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}

function MilestoneRow({
  childId,
  milestone,
  current,
}: {
  childId: string
  milestone: Milestone
  current: MilestoneStatus
}) {
  const [status, setStatus] = useState(current)
  const [pending, startTransition] = useTransition()

  function advance() {
    const next = STATUS_ORDER[(STATUS_ORDER.indexOf(status) + 1) % STATUS_ORDER.length]
    setStatus(next)
    startTransition(async () => {
      await setMilestoneStatus({
        child_id: childId,
        milestone_id: milestone.id,
        status: next,
        notes: null,
      })
    })
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border p-2.5">
      <div className="min-w-0">
        <div className="text-sm font-medium">{milestone.title}</div>
        {milestone.description ? (
          <div className="text-xs text-muted-foreground">{milestone.description}</div>
        ) : null}
      </div>
      <Button
        type="button"
        size="sm"
        variant={status === "achieved" ? "default" : "outline"}
        onClick={advance}
        disabled={pending}
        className="shrink-0"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : status === "achieved" ? (
          <Check className="size-3.5" />
        ) : status === "in_progress" ? (
          <CircleDashed className="size-3.5" />
        ) : null}
        {STATUS_LABEL[status]}
      </Button>
    </div>
  )
}
