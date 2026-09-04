"use client"

import { useTransition } from "react"
import { Trash2 } from "lucide-react"

import { deleteGalleryPhoto } from "@/app/(app)/teacher/gallery/actions"
import { dateLabel } from "@/lib/date"
import { Button } from "@/components/ui/button"

export type GalleryPhotoItem = {
  id: string
  path: string
  caption: string | null
  created_at: string
  url: string | null
}

export function GalleryGrid({
  photos,
  canDelete = false,
}: {
  photos: GalleryPhotoItem[]
  canDelete?: boolean
}) {
  const [pending, startTransition] = useTransition()

  if (photos.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No photos yet.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {photos.map((p) => (
        <figure key={p.id} className="group relative overflow-hidden rounded-lg border">
          {p.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.url}
              alt={p.caption ?? "Classroom photo"}
              className="aspect-square w-full object-cover"
            />
          ) : (
            <div className="aspect-square w-full bg-muted" />
          )}
          {canDelete ? (
            <Button
              type="button"
              variant="destructive"
              size="icon-sm"
              aria-label="Delete photo"
              disabled={pending}
              className="absolute top-1.5 right-1.5 opacity-90"
              onClick={() =>
                startTransition(() => void deleteGalleryPhoto(p.id, p.path))
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
          {p.caption ? (
            <figcaption className="absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-xs text-white">
              {p.caption}
            </figcaption>
          ) : null}
          <span className="sr-only">{dateLabel(p.created_at)}</span>
        </figure>
      ))}
    </div>
  )
}
