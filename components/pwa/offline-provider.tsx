"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { CloudOff, RefreshCw, WifiOff } from "lucide-react"

import { queueCount, onQueueChanged } from "@/lib/offline/queue"
import { drainQueue } from "@/lib/offline/sync"

export function OfflineProvider() {
  const router = useRouter()
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)

  // Register the service worker.
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {})
    }
    setOnline(navigator.onLine)
  }, [])

  // Track queue size.
  useEffect(() => {
    let active = true
    const refresh = () => queueCount().then((n) => active && setPending(n))
    refresh()
    const off = onQueueChanged(refresh)
    return () => {
      active = false
      off()
    }
  }, [])

  // Online/offline transitions + draining.
  useEffect(() => {
    async function sync() {
      setSyncing(true)
      const done = await drainQueue()
      setSyncing(false)
      setPending(await queueCount())
      if (done > 0) router.refresh()
    }
    function goOnline() {
      setOnline(true)
      void sync()
    }
    function goOffline() {
      setOnline(false)
    }
    window.addEventListener("online", goOnline)
    window.addEventListener("offline", goOffline)
    // Attempt a drain on mount in case ops were left from a previous session.
    if (navigator.onLine) void sync()
    return () => {
      window.removeEventListener("online", goOnline)
      window.removeEventListener("offline", goOffline)
    }
  }, [router])

  if (online && pending === 0 && !syncing) return null

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 flex justify-center px-3 md:bottom-3">
      <div className="flex items-center gap-2 rounded-full border bg-card px-3.5 py-2 text-sm shadow-lg">
        {!online ? (
          <>
            <WifiOff className="size-4 text-amber-600" />
            <span>Offline{pending ? ` · ${pending} queued` : ""}</span>
          </>
        ) : syncing ? (
          <>
            <RefreshCw className="size-4 animate-spin text-primary" />
            <span>Syncing…</span>
          </>
        ) : (
          <>
            <CloudOff className="size-4 text-amber-600" />
            <span>{pending} waiting to sync</span>
          </>
        )}
      </div>
    </div>
  )
}
