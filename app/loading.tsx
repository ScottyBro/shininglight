import { Skeleton } from "@/components/ui/skeleton"

// Ghost of the landing page's hero while getProfile() resolves.
export default function RootLoading() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-screen flex-col bg-gradient-to-b from-secondary/60 to-background"
    >
      <header className="flex items-center justify-between p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-24" />
      </header>
      <main className="flex flex-1 items-center justify-center px-6">
        <div className="grid w-full max-w-2xl justify-items-center gap-4">
          <Skeleton className="h-10 w-3/4 max-w-md" />
          <Skeleton className="h-5 w-full max-w-sm" />
          <Skeleton className="mt-4 h-11 w-40" />
        </div>
      </main>
      <footer className="p-6" />
    </div>
  )
}
