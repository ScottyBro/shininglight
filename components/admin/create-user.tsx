"use client"

import { useActionState, useEffect, useRef } from "react"

import { createUserAccount, type FormState } from "@/app/(app)/admin/actions"
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

const initial: FormState = {}

export function CreateUser() {
  const [state, action, pending] = useActionState(createUserAccount, initial)
  const formRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (state.message) formRef.current?.reset()
  }, [state.message])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create an account</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={action}
          className="grid gap-3 sm:grid-cols-2"
        >
          <div className="grid gap-2">
            <Label htmlFor="cu_full_name">Full name</Label>
            <Input id="cu_full_name" name="full_name" required placeholder="Jane Doe" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cu_email">Email</Label>
            <Input
              id="cu_email"
              name="email"
              type="email"
              required
              placeholder="jane@example.com"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cu_phone">Phone (optional)</Label>
            <Input id="cu_phone" name="phone" type="tel" placeholder="+263 …" />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cu_role">Role</Label>
            <Select name="role" defaultValue="parent">
              <SelectTrigger id="cu_role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="parent">Parent / Guardian</SelectItem>
                <SelectItem value="teacher">Teacher</SelectItem>
                <SelectItem value="admin">Administrator</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor="cu_password">Temporary password</Label>
            <Input
              id="cu_password"
              name="password"
              type="text"
              required
              minLength={8}
              placeholder="At least 8 characters"
            />
            <p className="text-xs text-muted-foreground">
              Share this with the person so they can sign in. They can change it
              later.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              {pending ? "Creating…" : "Create account"}
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
  )
}
