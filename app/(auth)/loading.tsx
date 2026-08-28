import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// Ghost of the auth card shape (title, description, a couple of fields, a
// submit button) while a slower auth page/redirect resolves.
export default function AuthLoading() {
  return (
    <Card aria-hidden="true">
      <CardHeader className="grid gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="grid gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-full" />
        </div>
        <Skeleton className="mt-2 h-9 w-full" />
      </CardContent>
    </Card>
  )
}
