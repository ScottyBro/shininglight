import { AlertTriangle, Stethoscope } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

/**
 * Safety-critical, high-visibility badges for allergies and medical notes.
 * Reused on child cards, the attendance roster and the checkout screen.
 */
export function ChildSafetyBadges({
  allergies,
  medicalNotes,
  className,
}: {
  allergies: string[] | null | undefined
  medicalNotes: string | null | undefined
  className?: string
}) {
  const hasAllergies = (allergies?.length ?? 0) > 0
  const hasMedical = !!medicalNotes?.trim()

  if (!hasAllergies && !hasMedical) return null

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {hasAllergies
        ? allergies!.map((a) => (
            <Badge
              key={a}
              variant="destructive"
              className="h-6 gap-1 px-2 text-[13px] font-semibold"
            >
              <AlertTriangle className="size-3.5" />
              {a}
            </Badge>
          ))
        : null}
      {hasMedical ? (
        <Badge
          variant="outline"
          className="h-6 gap-1 border-amber-500/60 bg-amber-500/10 px-2 text-[13px] font-semibold text-amber-700 dark:text-amber-300"
        >
          <Stethoscope className="size-3.5" />
          Medical
        </Badge>
      ) : null}
    </div>
  )
}
