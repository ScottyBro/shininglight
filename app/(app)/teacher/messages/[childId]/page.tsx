import Link from "next/link"
import { notFound } from "next/navigation"
import { ChevronLeft } from "lucide-react"

import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { getThreadMessages } from "@/lib/thread"
import { MarkRead } from "@/components/messages/mark-read"
import { PageHeader } from "@/components/page-header"
import { MessageList } from "@/components/messages/message-list"
import { MessageCompose } from "@/components/messages/message-compose"
import { RealtimeRefresh } from "@/components/realtime-refresh"

export const metadata = { title: "Message thread" }

export default async function TeacherThreadPage({
  params,
}: {
  params: Promise<{ childId: string }>
}) {
  const profile = await requireRole(["teacher", "admin"])
  const { childId } = await params
  const supabase = await createClient()

  const { data: child } = await supabase
    .from("children")
    .select("id, full_name")
    .eq("id", childId)
    .single()
  if (!child) notFound()

  const messages = await getThreadMessages(childId)

  return (
    <>
      <MarkRead childId={childId} />
      <RealtimeRefresh table="messages" channel={`teacher-thread-${childId}`} />
      <PageHeader title={child.full_name} description="Message thread" />
      <Link
        href="/teacher/messages"
        className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" /> All conversations
      </Link>

      <MessageList messages={messages} currentUserId={profile.id} />
      <MessageCompose
        childId={childId}
        enableAi
        childFirstName={child.full_name.split(" ")[0]}
      />
    </>
  )
}
