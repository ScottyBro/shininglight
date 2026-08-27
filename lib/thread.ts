import { createClient } from "@/lib/supabase/server"
import type { ThreadMessage } from "@/components/messages/message-list"

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
