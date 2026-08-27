import { WifiOff } from "lucide-react"

export const metadata = { title: "Offline" }

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <WifiOff className="size-8 text-muted-foreground" />
      </div>
      <h1 className="font-heading text-2xl font-extrabold">You&apos;re offline</h1>
      <p className="max-w-sm text-muted-foreground">
        Pages you&apos;ve already opened are still available. Any check-ins or
        reports you save now are queued and will sync automatically when
        you&apos;re back online.
      </p>
    </div>
  )
}
