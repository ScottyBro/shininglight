import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { signedUrl } from "@/lib/storage"
import { cn } from "@/lib/utils"

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("")
}

/**
 * Server component: resolves a private child photo to a signed URL and falls
 * back to initials. `photoPath` is the stored object path in `child-photos`.
 */
export async function ChildAvatar({
  name,
  photoPath,
  className,
}: {
  name: string
  photoPath: string | null | undefined
  className?: string
}) {
  const url = await signedUrl("child-photos", photoPath)

  return (
    <Avatar className={cn("size-10", className)}>
      {url ? <AvatarImage src={url} alt={name} /> : null}
      <AvatarFallback>{initials(name)}</AvatarFallback>
    </Avatar>
  )
}
