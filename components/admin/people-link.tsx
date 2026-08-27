"use client"

import { useActionState } from "react"

import { linkParent, type FormState } from "@/app/(app)/admin/actions"
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

export function PeopleLink({
  parents,
  childOptions,
}: {
  parents: { id: string; full_name: string | null }[]
  childOptions: { id: string; full_name: string }[]
}) {
  const [state, formAction, pending] = useActionState(linkParent, initialState)
  // Without an `items` value->label map, Base UI's Select shows the raw id.
  const parentItems: Record<string, string> = Object.fromEntries(
    parents.map((p) => [p.id, p.full_name ?? "Unnamed parent"])
  )
  const childItems: Record<string, string> = Object.fromEntries(
    childOptions.map((c) => [c.id, c.full_name])
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link a parent to a child</CardTitle>
      </CardHeader>
      <CardContent>
        {parents.length === 0 || childOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You need at least one parent account and one enrolled child to
            create a link.
          </p>
        ) : (
          <form
            action={formAction}
            className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end"
          >
            <div className="grid gap-2">
              <Label htmlFor="parent_id">Parent</Label>
              <Select name="parent_id" items={parentItems}>
                <SelectTrigger id="parent_id" className="w-full">
                  <SelectValue placeholder="Choose a parent" />
                </SelectTrigger>
                <SelectContent>
                  {parents.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? "Unnamed parent"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="child_id">Child</Label>
              <Select name="child_id" items={childItems}>
                <SelectTrigger id="child_id" className="w-full">
                  <SelectValue placeholder="Choose a child" />
                </SelectTrigger>
                <SelectContent>
                  {childOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="relationship">Relationship</Label>
              <Input id="relationship" name="relationship" placeholder="Father" />
            </div>
            <Button type="submit" disabled={pending}>
              {pending ? "Linking…" : "Link"}
            </Button>
          </form>
        )}
        {state.error ? (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {state.error}
          </p>
        ) : null}
        {state.message ? (
          <p className="mt-3 text-sm text-primary" role="status">
            {state.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}
