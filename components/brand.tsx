import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * The crest only — public/logo-mark.png is the school logo with its
 * "PRE-SCHOOL" wordmark cropped off, since every caller pairs the mark with
 * the school name as live text and would otherwise show it twice.
 */
export function BrandMark({
  className,
  size = 40,
}: {
  className?: string
  size?: number
}) {
  return (
    <Image
      src="/logo-mark.png"
      alt=""
      width={size}
      height={size}
      priority
      className={cn("object-contain", className)}
      style={{ width: size, height: size }}
    />
  )
}

export function BrandLockup({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark />
      <div className="leading-tight">
        <div className="font-heading text-lg font-extrabold tracking-tight">
          Shining Light
        </div>
        <div className="text-xs text-muted-foreground">Pre-School</div>
      </div>
    </div>
  )
}
