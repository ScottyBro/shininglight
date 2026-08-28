"use client"

import { useActionState, useEffect, useState } from "react"
import { KeyRound } from "lucide-react"

import { resetUserPassword, type FormState } from "@/app/(app)/admin/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const initial: FormState = {}

export function ResetPasswordButton({
  userId,
  name,
}: {
  userId: string
  name: string
}) {
  const [open, setOpen] = useState(false)
  const [state, action, pending] = useActionState(resetUserPassword, initial)

  useEffect(() => {
    if (state.message) setOpen(false)
  }, [state.message])

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Reset password for ${name}`}
        onClick={() => setOpen(true)}
      >
        <KeyRound className="size-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset password</DialogTitle>
            <DialogDescription>
              Set a new temporary password for {name}. Share it with them
              directly — they can change it after signing in.
            </DialogDescription>
          </DialogHeader>
          <form action={action} className="grid gap-3">
            <input type="hidden" name="user_id" value={userId} />
            <div className="grid gap-2">
              <Label htmlFor={`newpass-${userId}`}>New temporary password</Label>
              <Input
                id={`newpass-${userId}`}
                name="password"
                type="text"
                required
                minLength={8}
                placeholder="At least 8 characters"
              />
            </div>
            {state.error ? (
              <p className="text-sm text-destructive" role="alert">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Reset password"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
