"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { createClient } from "@/lib/supabase/client"

/**
 * Subscribes to Postgres changes on a table and refreshes the current route
 * when a relevant row changes, so server-rendered feeds update live. RLS is
 * still enforced on the realtime stream, so a parent only ever receives their
 * own children's rows.
 */
export function RealtimeRefresh({
  table,
  channel,
}: {
  table: string
  channel: string
}) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    const sub = supabase
      .channel(channel)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        () => router.refresh()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [table, channel, router])

  return null
}
