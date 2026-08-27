import { requireRole } from "@/lib/auth"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/page-header"
import { ChildForm } from "@/components/admin/child-form"

export const metadata = { title: "Enroll a child" }

export default async function NewChildPage() {
  await requireRole("admin")
  const supabase = await createClient()
  const { data: classrooms } = await supabase
    .from("classrooms")
    .select("id, name")
    .order("name")

  return (
    <>
      <PageHeader
        title="Enroll a child"
        description="Create the child's full profile. You can edit any of this later."
      />
      <ChildForm classrooms={classrooms ?? []} />
    </>
  )
}
