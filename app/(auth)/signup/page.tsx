import type { Metadata } from "next"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = { title: "Accounts" }

export default function SignupPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Accounts are created by staff</CardTitle>
        <CardDescription>
          For your family&apos;s privacy and safety, Shining Light accounts are
          set up by a school administrator — there&apos;s no public sign-up.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <p>
          If you&apos;re a parent or a member of staff and need access, please
          ask the school office to create your account. They&apos;ll give you an
          email and a temporary password to sign in with.
        </p>
        <Button asChild className="mt-2 w-full" size="lg">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
