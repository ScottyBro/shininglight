import { createClient } from "@/lib/supabase/server"

/**
 * Mint a short-lived signed URL for a private storage object.
 * `path` may be either a bare object path ("childId/uuid.jpg") or a
 * "bucket/path" combined string. Returns null if there is no path or signing
 * fails (the UI then falls back to initials).
 */
export async function signedUrl(
  bucket: string,
  path: string | null | undefined,
  expiresInSeconds = 60 * 60
): Promise<string | null> {
  if (!path) return null

  // Allow callers to store "bucket/objectPath" and pass it through.
  let objectPath = path
  if (path.startsWith(`${bucket}/`)) {
    objectPath = path.slice(bucket.length + 1)
  }

  try {
    const supabase = await createClient()
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(objectPath, expiresInSeconds)
    if (error) return null
    return data?.signedUrl ?? null
  } catch {
    return null
  }
}
