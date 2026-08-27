import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTeacherRoster } from "@/lib/roster"
import { signedUrl } from "@/lib/storage"
import { schoolToday, dateLabel } from "@/lib/date"
import { PageHeader } from "@/components/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { AttendanceRoster } from "@/components/teacher/attendance-roster"
import type { AttendanceChild } from "@/components/teacher/attendance-roster"

export const metadata = { title: "Attendance" }

export default async function AttendancePage() {
  const profile = await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  const { children } = await getTeacherRoster(profile.id)
  const date = schoolToday()

  const childIds = children.map((c) => c.id)
  const { data: attendance } = childIds.length
    ? await supabase
        .from("attendance")
        .select("child_id, check_in_at, check_out_at, check_in_by, check_out_by")
        .in("child_id", childIds)
        .eq("date", date)
    : { data: [] }

  const attByChild = new Map(
    (attendance ?? []).map((a) => [a.child_id, a])
  )

  // Resolve staff display names for whoever checked children in/out.
  const staffIds = new Set<string>()
  for (const a of attendance ?? []) {
    if (a.check_in_by) staffIds.add(a.check_in_by)
    if (a.check_out_by) staffIds.add(a.check_out_by)
  }
  const staffNames = new Map<string, string>()
  if (staffIds.size) {
    const { data: staff } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", [...staffIds])
    for (const s of staff ?? []) {
      staffNames.set(s.id, s.id === profile.id ? "you" : s.full_name ?? "staff")
    }
  }

  const items: AttendanceChild[] = await Promise.all(
    children.map(async (c) => {
      const att = attByChild.get(c.id)
      const pickups = await Promise.all(
        (c.authorized_pickups ?? []).map(async (p) => ({
          name: p.name,
          relationship: p.relationship ?? "",
          pin: p.pin ?? "",
          photoUrl: p.photo_url
            ? await signedUrl("pickup-photos", p.photo_url)
            : null,
        }))
      )
      return {
        id: c.id,
        full_name: c.full_name,
        photoUrl: await signedUrl("child-photos", c.photo_url),
        allergies: c.allergies ?? [],
        medical_notes: c.medical_notes,
        pickups,
        checkInAt: att?.check_in_at ?? null,
        checkOutAt: att?.check_out_at ?? null,
        checkInBy: att?.check_in_by ? staffNames.get(att.check_in_by) ?? null : null,
        checkOutBy: att?.check_out_by
          ? staffNames.get(att.check_out_by) ?? null
          : null,
      }
    })
  )

  const present = items.filter((i) => i.checkInAt && !i.checkOutAt).length

  return (
    <>
      <PageHeader
        title="Attendance"
        description={dateLabel(date)}
      />

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No active children in your classroom yet.
          </CardContent>
        </Card>
      ) : (
        <>
          <p className="mb-4 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{present}</span> of{" "}
            {items.length} currently checked in.
          </p>
          <AttendanceRoster items={items} />
        </>
      )}
    </>
  )
}
