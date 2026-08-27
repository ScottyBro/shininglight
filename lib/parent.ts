import { createClient } from "@/lib/supabase/server"

export type LinkedChild = {
  id: string
  full_name: string
  photo_url: string | null
}

/** The children linked to a parent account. */
export async function getParentChildren(
  parentId: string
): Promise<LinkedChild[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("parent_children")
    .select("children(id, full_name, photo_url)")
    .eq("parent_id", parentId)

  return ((data ?? []) as unknown as { children: LinkedChild | null }[])
    .map((l) => l.children)
    .filter((c): c is LinkedChild => Boolean(c))
    .sort((a, b) => a.full_name.localeCompare(b.full_name))
}
