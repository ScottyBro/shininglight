"use client"

import Link from "next/link"
import { useActionState } from "react"
import { Loader2 } from "lucide-react"

import { requestPasswordReset, type AuthState } from "@/app/auth/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AuthState = {}

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    requestPasswordReset,
    initialState
  )

  if (state.message) {
    return (
      <div className="grid gap-4 text-center">
        <p className="text-sm text-primary" role="status">
          {state.message}
        </p>
        <Link href="/login" className="text-sm font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          placeholder="you@example.com"
        />
      </div>

      {state.error ? (
        <p className="text-sm text-destructive" role="alert">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="mt-2 w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Sending…
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="font-medium text-primary hover:underline">
          ← Back to sign in
        </Link>
      </p>
    </form>
  )
}
