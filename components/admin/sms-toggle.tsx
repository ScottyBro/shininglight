"use client"

import { useTransition } from "react"
import { MessageSquareText } from "lucide-react"

import { toggleSmsOptIn } from "@/app/(app)/admin/actions"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function SmsToggle({
  userId,
  name,
  optedIn,
}: {
  userId: string
  name: string
  optedIn: boolean
}) {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={`${optedIn ? "Disable" : "Enable"} SMS notifications for ${name}`}
      aria-pressed={optedIn}
      disabled={pending}
      title={optedIn ? "SMS notifications on" : "SMS notifications off"}
      className={cn(optedIn && "text-primary")}
      onClick={() => startTransition(() => void toggleSmsOptIn(userId, !optedIn))}
    >
      <MessageSquareText className="size-3.5" fill={optedIn ? "currentColor" : "none"} />
    </Button>
  )
}
