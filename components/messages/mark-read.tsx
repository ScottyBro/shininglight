"use client"

import { useEffect } from "react"

import { markThreadRead } from "@/lib/messages"

/**
 * Fires markThreadRead as a genuine client-invoked action on mount, so its
 * revalidatePath call refreshes the shared layout's unread-messages badge.
 * Renders nothing.
 */
export function MarkRead({ childId }: { childId: string }) {
  useEffect(() => {
    void markThreadRead(childId)
  }, [childId])
  return null
}
