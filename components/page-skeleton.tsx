import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

/**
 * A generic "ghost" of a typical app page: a page-header shape followed by a
 * grid of card shapes. Rendered by (app)/loading.tsx while a route segment's
 * data is still loading, inside the already-painted app shell (nav, header),
 * so only the content area shows the placeholder.
 */
export function PageSkeleton({ cards = 6 }: { cards?: number }) {
  return (
    <div aria-hidden="true">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-32" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: cards }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-3 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
