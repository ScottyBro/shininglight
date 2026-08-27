import { Sun } from "lucide-react"

import { cn } from "@/lib/utils"

export function BrandMark({
  className,
  size = 40,
}: {
  className?: string
  size?: number
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm",
        className
      )}
      style={{ width: size, height: size }}
    >
      <Sun style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2.5} />
    </span>
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
