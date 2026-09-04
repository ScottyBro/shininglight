"use client"

import { useActionState } from "react"
import { Trash2 } from "lucide-react"

import {
  createMilestone,
  deleteMilestone,
  type MilestoneFormState,
} from "@/app/(app)/admin/milestones/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Milestone, MilestoneDomain } from "@/lib/types/database"

const initial: MilestoneFormState = {}

const DOMAIN_LABEL: Record<MilestoneDomain, string> = {
  motor: "Motor",
  cognitive: "Cognitive",
  language: "Language",
  social: "Social / emotional",
}
const DOMAIN_ITEMS: Record<string, string> = DOMAIN_LABEL

function ageLabel(min: number, max: number) {
  const fmt = (m: number) => (m < 12 ? `${m}mo` : `${Math.floor(m / 12)}y${m % 12 ? ` ${m % 12}mo` : ""}`)
  return `${fmt(min)}–${fmt(max)}`
}

export function MilestoneLibrary({ milestones }: { milestones: Milestone[] }) {
  const [state, action, pending] = useActionState(createMilestone, initial)

  const byDomain = new Map<MilestoneDomain, Milestone[]>()
  for (const m of milestones) {
    const list = byDomain.get(m.domain) ?? []
    list.push(m)
    byDomain.set(m.domain, list)
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Add a milestone</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="grid gap-3 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" name="title" required placeholder="Holds a pencil/crayon" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="domain">Domain</Label>
              <Select name="domain" defaultValue="motor" items={DOMAIN_ITEMS}>
                <SelectTrigger id="domain" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOMAIN_LABEL) as MilestoneDomain[]).map((d) => (
                    <SelectItem key={d} value={d}>
                      {DOMAIN_LABEL[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="grid gap-2">
                <Label htmlFor="min_age_months">Min age (months)</Label>
                <Input id="min_age_months" name="min_age_months" type="number" min={0} max={72} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="max_age_months">Max age (months)</Label>
                <Input id="max_age_months" name="max_age_months" type="number" min={0} max={72} required />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea id="description" name="description" rows={1} placeholder="What to look for" />
            </div>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={pending}>
                {pending ? "Saving…" : "Add milestone"}
              </Button>
            </div>
            {state.error ? (
              <p className="text-sm text-destructive sm:col-span-2" role="alert">
                {state.error}
              </p>
            ) : null}
            {state.message ? (
              <p className="text-sm text-primary sm:col-span-2" role="status">
                {state.message}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>

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
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm"
                >
                  <div>
                    <div className="font-medium">{m.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {ageLabel(m.min_age_months, m.max_age_months)}
                      {m.description ? ` · ${m.description}` : ""}
                    </div>
                  </div>
                  <form action={deleteMilestone.bind(null, m.id)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete milestone"
                      className="text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </form>
                </div>
              ))}
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
