import Link from "next/link"
import { LogIn, LogOut } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { schoolToday, timeLabel } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChildAvatar } from "@/components/child-avatar"

export const metadata = { title: "Home" }

export default async function ParentHome() {
  const profile = await requireRole("parent")
  const supabase = await createClient()

  type ChildSummary = {
    id: string
    full_name: string
    photo_url: string | null
    classroom_id: string | null
  }
  const { data: links } = await supabase
    .from("parent_children")
    .select("child_id, children(id, full_name, photo_url, classroom_id)")
    .eq("parent_id", profile.id)

  const children = ((links ?? []) as unknown as {
    children: ChildSummary | null
  }[])
    .map((l) => l.children)
    .filter((c): c is ChildSummary => Boolean(c))

  const ids = children.map((c) => c.id)
  const today = schoolToday()
  const { data: attendance } = ids.length
    ? await supabase
        .from("attendance")
        .select("child_id, check_in_at, check_out_at")
        .in("child_id", ids)
        .eq("date", today)
    : { data: [] }

  const attByChild = new Map((attendance ?? []).map((a) => [a.child_id, a]))

  return (
    <>
      <PageHeader
        title={`Hello, ${profile.full_name ?? "there"}`}
        description="Your children's day at a glance."
      />

      {children.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No children linked yet</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Once the school links your account to your child, their reports and
            billing will appear here.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((child) => {
            const att = attByChild.get(child.id)
            return (
              <Card key={child.id}>
                <CardHeader className="flex-row items-center gap-3 space-y-0">
                  <ChildAvatar name={child.full_name} photoPath={child.photo_url} />
                  <CardTitle>{child.full_name}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <AttendanceStatus
                    checkInAt={att?.check_in_at ?? null}
                    checkOutAt={att?.check_out_at ?? null}
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button asChild variant="outline" size="sm">
                      <Link href="/parent/reports">Reports</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/parent/billing">Billing</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/parent/messages">Messages</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}

function AttendanceStatus({
  checkInAt,
  checkOutAt,
}: {
  checkInAt: string | null
  checkOutAt: string | null
}) {
  if (checkOutAt) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <LogOut className="size-4" />
        Checked out at {timeLabel(checkOutAt)}
      </p>
    )
  }
  if (checkInAt) {
    return (
      <p className="flex items-center gap-1.5 text-sm text-primary">
        <LogIn className="size-4" />
        Checked in at {timeLabel(checkInAt)}
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">Not checked in yet today.</p>
  )
}
