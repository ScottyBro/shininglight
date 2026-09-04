import { requireRole } from "@/lib/auth"
import { getParentChildren } from "@/lib/parent"
import { createClient } from "@/lib/supabase/server"
import { signedUrl } from "@/lib/storage"
import { PageHeader } from "@/components/page-header"
import { GalleryGrid } from "@/components/gallery-grid"
import { Card, CardContent } from "@/components/ui/card"

export const metadata = { title: "Gallery" }

export default async function ParentGalleryPage() {
  const profile = await requireRole("parent")
  const children = await getParentChildren(profile.id)
  const supabase = await createClient()

  const { data: links } = children.length
    ? await supabase
        .from("children")
        .select("id, classroom_id, classroom:classrooms(id, name)")
        .in(
          "id",
          children.map((c) => c.id)
        )
    : { data: [] }

  const rooms = new Map<string, string>()
  for (const row of (links ?? []) as unknown as Array<{
    classroom_id: string | null
    classroom: { id: string; name: string } | null
  }>) {
    if (row.classroom) rooms.set(row.classroom.id, row.classroom.name)
  }

  const sections = await Promise.all(
    Array.from(rooms.entries()).map(async ([classroomId, name]) => {
      const { data: photos } = await supabase
        .from("gallery_photos")
        .select("id, path, caption, created_at")
        .eq("classroom_id", classroomId)
        .order("created_at", { ascending: false })

      const resolved = await Promise.all(
        (photos ?? []).map(async (p) => ({
          ...p,
          url: await signedUrl("gallery-photos", p.path),
        }))
      )
      return { classroomId, name, photos: resolved }
    })
  )

  return (
    <>
      <PageHeader
        title="Gallery"
        description="Shared photos from your child's classroom."
      />

      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Nothing to show yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {sections.map((s) => (
            <div key={s.classroomId} className="grid gap-3">
              <h2 className="text-lg font-semibold">{s.name}</h2>
              <Card>
                <CardContent className="pt-4">
                  <GalleryGrid photos={s.photos} />
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
