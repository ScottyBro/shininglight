"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { homePathForRole } from "@/lib/auth"

export type AuthState = { error?: string; message?: string }

// Emails are trimmed + lowercased before validation so a stray space from
// autofill/paste (or different capitalisation between sign-up and sign-in)
// never causes a spurious "invalid email" or a failed login.
const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email address."))

const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1, "Password is required."),
})

export async function login(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { error: "Incorrect email or password." }
  }

  const { data } = await supabase.from("profiles").select("role").single()

  revalidatePath("/", "layout")
  redirect(data?.role ? homePathForRole(data.role) : "/dashboard")
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
