import { createClient } from "@/lib/supabase/server"
import { getParentChildren } from "@/lib/parent"
import { getTeacherRoster } from "@/lib/roster"
import type { ThreadMessage } from "@/components/messages/message-list"
import type { Profile } from "@/lib/types/database"

/** Load a child's message thread (oldest first) with sender names. RLS
 *  ensures only participants (admin, the child's parent, their teacher) can
 *  read it. */
export async function getThreadMessages(
  childId: string
): Promise<ThreadMessage[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("messages")
    .select("id, body, created_at, sender_id, sender:profiles(full_name, role)")
    .eq("child_id", childId)
    .order("created_at", { ascending: true })

  return ((data ?? []) as unknown as Array<{
    id: string
    body: string
    created_at: string
    sender_id: string
    sender: { full_name: string | null; role: string } | null
  }>).map((m) => ({
    id: m.id,
    body: m.body,
    created_at: m.created_at,
    sender_id: m.sender_id,
    sender_name: m.sender?.full_name ?? "Someone",
    sender_role: m.sender?.role ?? "",
  }))
}

/**
 * Count of messages the current teacher/parent has not yet read, across
 * every child's thread they're a participant in. Used to badge the Messages
 * nav item. Admins aren't a designed messaging participant in the UI, so
 * this returns 0 for them.
 */
export async function getUnreadMessageCount(profile: Profile): Promise<number> {
  let childIds: string[] = []
  if (profile.role === "parent") {
    childIds = (await getParentChildren(profile.id)).map((c) => c.id)
  } else if (profile.role === "teacher") {
    childIds = (await getTeacherRoster(profile.id)).children.map((c) => c.id)
  }
  if (childIds.length === 0) return 0

  const supabase = await createClient()
  const { count } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .in("child_id", childIds)
    .is("read_at", null)
    .neq("sender_id", profile.id)
  return count ?? 0
}
