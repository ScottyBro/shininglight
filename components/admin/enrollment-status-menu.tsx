"use client"

import { useTransition } from "react"
import { ChevronDown } from "lucide-react"

import { setEnrollmentStatus } from "@/app/(app)/admin/actions"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { EnrollmentStatus } from "@/lib/types/database"

const STATUS_VARIANT: Record<EnrollmentStatus, "default" | "secondary" | "outline"> = {
  active: "default",
  waitlisted: "secondary",
  withdrawn: "outline",
}
const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  active: "Active",
  waitlisted: "Waitlisted",
  withdrawn: "Withdrawn",
}
const OPTIONS: EnrollmentStatus[] = ["active", "waitlisted", "withdrawn"]

export function EnrollmentStatusMenu({
  childId,
  status,
}: {
  childId: string
  status: EnrollmentStatus
}) {
  const [pending, startTransition] = useTransition()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger disabled={pending}>
        <Badge variant={STATUS_VARIANT[status]} className="cursor-pointer gap-1">
          {pending ? "Saving…" : STATUS_LABEL[status]}
          <ChevronDown className="size-3" />
        </Badge>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        {OPTIONS.filter((o) => o !== status).map((option) => (
          <DropdownMenuItem
            key={option}
            onClick={() =>
              startTransition(() => void setEnrollmentStatus(childId, option))
            }
          >
            Mark as {STATUS_LABEL[option]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
