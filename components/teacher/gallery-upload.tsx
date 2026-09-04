"use client"

import { useActionState, useEffect, useRef, useState } from "react"
import { ImagePlus } from "lucide-react"

import { uploadGalleryPhotos, type GalleryState } from "@/app/(app)/teacher/gallery/actions"
import { downscaleInputFiles } from "@/lib/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"

const initial: GalleryState = {}

export function GalleryUpload({ classroomId }: { classroomId: string }) {
  const [state, action, pending] = useActionState(uploadGalleryPhotos, initial)
  const formRef = useRef<HTMLFormElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)

  useEffect(() => {
    if (state.message) formRef.current?.reset()
  }, [state.message])

  return (
    <Card>
      <CardContent className="py-4">
        <form ref={formRef} action={action} className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input type="hidden" name="classroom_id" value={classroomId} />
          <div className="grid gap-2">
            <Label htmlFor={`photos-${classroomId}`}>Add photos</Label>
            <Input
              id={`photos-${classroomId}`}
              name="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={async (e) => {
                const el = e.currentTarget
                setPhotoBusy(true)
                await downscaleInputFiles(el)
                setPhotoBusy(false)
              }}
            />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label htmlFor={`caption-${classroomId}`}>Caption (optional)</Label>
            <Input
              id={`caption-${classroomId}`}
              name="caption"
              placeholder="Outdoor play this morning"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={pending || photoBusy}>
              <ImagePlus className="size-4" />
              {photoBusy ? "Processing…" : pending ? "Uploading…" : "Add to album"}
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
