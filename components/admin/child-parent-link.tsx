"use client"

import { useActionState } from "react"
import { X } from "lucide-react"

import {
  linkParent,
  unlinkParent,
  type FormState,
} from "@/app/(app)/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const initialState: FormState = {}

type ParentOption = { id: string; full_name: string | null; phone: string | null }
type LinkedParent = {
  relationship: string | null
  parent: ParentOption | null
}

export function ChildParentLink({
  childId,
  parents,
  linked,
}: {
  childId: string
  parents: ParentOption[]
  linked: LinkedParent[]
}) {
  const [state, formAction, pending] = useActionState(linkParent, initialState)
  const linkedIds = new Set(linked.map((l) => l.parent?.id))
  const available = parents.filter((p) => !linkedIds.has(p.id))
  // Without an `items` value->label map, Base UI's Select shows the raw id.
  const parentItems: Record<string, string> = Object.fromEntries(
    available.map((p) => [p.id, p.full_name ?? "Unnamed parent"])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Linked parents / guardians</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        {linked.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No parents linked yet. Parents only see children linked to them here.
          </p>
        ) : (
          <ul className="grid gap-2">
            {linked.map((l) =>
              l.parent ? (
                <li
                  key={l.parent.id}
                  className="flex items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                >
                  <span>
                    <span className="font-medium">
                      {l.parent.full_name ?? "Unnamed parent"}
                    </span>
                    {l.relationship ? (
                      <span className="text-muted-foreground"> · {l.relationship}</span>
                    ) : null}
                    {l.parent.phone ? (
                      <span className="block text-xs text-muted-foreground">
                        {l.parent.phone}
                      </span>
                    ) : null}
                  </span>
                  <form action={unlinkParent.bind(null, l.parent.id, childId)}>
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon"
                      aria-label="Unlink parent"
                    >
                      <X className="size-4" />
                    </Button>
                  </form>
                </li>
              ) : null
            )}
          </ul>
        )}

        {available.length > 0 ? (
          <form action={formAction} className="grid gap-3 border-t pt-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <input type="hidden" name="child_id" value={childId} />
            <div className="grid gap-2">
              <Label htmlFor="parent_id">Add a parent</Label>
              <Select name="parent_id" items={parentItems}>
                <SelectTrigger id="parent_id" className="w-full">
                  <SelectValue placeholder="Choose a parent" />
                </SelectTrigger>
                <SelectContent>
                  {available.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? "Unnamed parent"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Input id="relationship" name="relationship" placeholder="Mother" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Linking…" : "Link"}
            </Button>
          </form>
        ) : (
          <p className="text-sm text-muted-foreground">
            All parent accounts are linked. New parents appear here after they
            sign up.
          </p>
        )}

        {state.error ? (
          <p className="text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
