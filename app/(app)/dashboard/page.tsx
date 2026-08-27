import { redirect } from "next/navigation"

import { homePathForRole, requireProfile } from "@/lib/auth"

export default async function DashboardRedirect() {
  const profile = await requireProfile()
  redirect(homePathForRole(profile.role))
}
