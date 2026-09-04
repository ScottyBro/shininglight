import { AlertTriangle } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getTeacherRoster } from "@/lib/roster"
import { signedUrl } from "@/lib/storage"
import { PageHeader } from "@/components/page-header"
import { GalleryUpload } from "@/components/teacher/gallery-upload"
import { GalleryGrid } from "@/components/gallery-grid"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export const metadata = { title: "Gallery" }

export default async function TeacherGalleryPage() {
  const profile = await requireRole(["teacher", "admin"])
  const { classrooms, children } = await getTeacherRoster(profile.id)
  const supabase = await createClient()

  if (classrooms.length === 0) {
    return (
      <>
        <PageHeader title="Gallery" description="Your classroom's shared photo album." />
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No classroom assigned yet.
          </CardContent>
        </Card>
      </>
    )
  }

  const sections = await Promise.all(
    classrooms.map(async (room) => {
      const { data: photos } = await supabase
        .from("gallery_photos")
        .select("id, path, caption, created_at")
        .eq("classroom_id", room.id)
        .order("created_at", { ascending: false })

      const resolved = await Promise.all(
        (photos ?? []).map(async (p) => ({
          ...p,
          url: await signedUrl("gallery-photos", p.path),
        }))
      )

      const noConsent = children.filter(
        (c) => c.classroom_id === room.id && !c.gallery_consent
      )

      return { room, photos: resolved, noConsent }
    })
  )

  return (
    <>
      <PageHeader
        title="Gallery"
        description="A running album for your classroom — visible to every family in the room."
      />

      <div className="grid gap-6">
        {sections.map(({ room, photos, noConsent }) => (
          <div key={room.id} className="grid gap-3">
            <h2 className="text-lg font-semibold">{room.name}</h2>

            {noConsent.length > 0 ? (
              <Card className="border-amber-500/40 bg-amber-500/10">
                <CardContent className="flex items-start gap-2.5 py-3 text-sm text-amber-800 dark:text-amber-300">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Keep {noConsent.map((c) => c.full_name).join(", ")} out of
                    frame — {noConsent.length === 1 ? "this family hasn't" : "these families haven't"}{" "}
                    consented to shared classroom photos.
                  </span>
                </CardContent>
              </Card>
            ) : null}

            <GalleryUpload classroomId={room.id} />

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{photos.length} photo{photos.length === 1 ? "" : "s"}</CardTitle>
              </CardHeader>
              <CardContent>
                <GalleryGrid photos={photos} canDelete />
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
    </>
  )
}
