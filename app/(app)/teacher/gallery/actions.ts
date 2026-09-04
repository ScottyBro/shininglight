"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { uuidField } from "@/lib/validation"

export type GalleryState = { error?: string; message?: string }

const uploadSchema = z.object({
  classroom_id: uuidField("Missing classroom."),
  caption: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? v : null)),
})

export async function uploadGalleryPhotos(
  _prev: GalleryState,
  formData: FormData
): Promise<GalleryState> {
  const profile = await requireRole(["teacher", "admin"])
  const parsed = uploadSchema.safeParse({
    classroom_id: formData.get("classroom_id"),
    caption: formData.get("caption") ?? undefined,
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0)
  if (files.length === 0) {
    return { error: "Choose at least one photo." }
  }

  const supabase = await createClient()
  const rows: { classroom_id: string; path: string; caption: string | null; uploaded_by: string }[] = []

  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() || "jpg"
    const path = `${parsed.data.classroom_id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage
      .from("gallery-photos")
      .upload(path, file, { contentType: file.type || undefined })
    if (!error) {
      rows.push({
        classroom_id: parsed.data.classroom_id,
        path,
        caption: parsed.data.caption,
        uploaded_by: profile.id,
      })
    }
  }

  if (rows.length === 0) {
    return { error: "Could not upload the photo(s). Try again." }
  }

  const { error: insertError } = await supabase.from("gallery_photos").insert(rows)
  if (insertError) return { error: insertError.message }

  revalidatePath("/teacher/gallery")
  revalidatePath("/parent/gallery")
  return {
    message: `Added ${rows.length} photo${rows.length === 1 ? "" : "s"} to the album.`,
  }
}

export async function deleteGalleryPhoto(photoId: string, path: string) {
  await requireRole(["teacher", "admin"])
  const supabase = await createClient()
  await supabase.storage.from("gallery-photos").remove([path])
  await supabase.from("gallery_photos").delete().eq("id", photoId)
  revalidatePath("/teacher/gallery")
  revalidatePath("/parent/gallery")
}
