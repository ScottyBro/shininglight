"use client"

/**
 * Downscale + re-encode an image File in the browser before it is uploaded
 * through a server action. Keeps payloads small so uploads stay under the
 * Server Action body limit and Vercel's function body cap, and saves the
 * family's data. Non-images (or any failure) are returned unchanged.
 */
export async function downscaleImage(
  file: File,
  maxDim = 1600,
  quality = 0.8
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file
  try {
    const bitmap = await createImageBitmap(file)
    const largest = Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, maxDim / largest)

    // Already small in both dimensions and bytes — leave it alone.
    if (scale === 1 && file.size < 900_000) {
      bitmap.close?.()
      return file
    }

    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality)
    )
    if (!blob || blob.size >= file.size) return file

    const name = file.name.replace(/\.[^.]+$/, "") + ".jpg"
    return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() })
  } catch {
    return file
  }
}

/**
 * Replace a file input's selected files with downscaled versions, so the
 * native form submit sends the smaller images.
 */
export async function downscaleInputFiles(input: HTMLInputElement): Promise<void> {
  const files = input.files
  if (!files || files.length === 0) return
  const out = new DataTransfer()
  for (const f of Array.from(files)) {
    out.items.add(await downscaleImage(f))
  }
  input.files = out.files
}
