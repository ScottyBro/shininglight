import { PageSkeleton } from "@/components/page-skeleton"

// Automatically shown by Next.js while a route inside (app) is loading its
// data — the layout (nav, header) is already painted, so only this ghost of
// the content area appears, replaced by the real page once it's ready.
export default function AppLoading() {
  return <PageSkeleton />
}
