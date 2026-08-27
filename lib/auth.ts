import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import type { Profile, UserRole } from "@/lib/types/database"

/** The signed-in auth user, or null. */
export async function getUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/** The signed-in user's profile (role, name, ...), or null. */
export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return data
}

/** Require a signed-in user with a profile; redirect to /login otherwise. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile()
  if (!profile) redirect("/login")
  return profile
}

/**
 * Require the signed-in user to hold one of the given roles.
 * Redirects unauthenticated users to /login and wrong-role users to their
 * own dashboard (which is safe for every role).
 */
export async function requireRole(
  roles: UserRole | UserRole[]
): Promise<Profile> {
  const allowed = Array.isArray(roles) ? roles : [roles]
  const profile = await requireProfile()
  if (!allowed.includes(profile.role)) redirect("/dashboard")
  return profile
}

/** Where each role lands after signing in. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin"
    case "teacher":
      return "/teacher"
    case "parent":
      return "/parent"
    default:
      return "/dashboard"
  }
}
