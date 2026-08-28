"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { getUser, homePathForRole } from "@/lib/auth"
import { publicEnv } from "@/lib/env"

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

const forgotPasswordSchema = z.object({ email: emailField })

/**
 * Request a password-reset email. Always returns the same message whether
 * or not the address has an account, so this can't be used to enumerate
 * registered emails.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/reset-password`,
  })

  return {
    message:
      "If that email has an account, we've sent a link to reset the password.",
  }
}

const newPasswordSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords don't match.",
    path: ["confirm"],
  })

/**
 * Set a new password. Requires the recovery session established by clicking
 * the emailed reset link (via /auth/confirm), not a fresh sign-in.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const user = await getUser()
  if (!user) {
    return { error: "This reset link has expired. Request a new one." }
  }

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  })
  if (error) return { error: error.message }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .single()

  revalidatePath("/", "layout")
  redirect(profile?.role ? homePathForRole(profile.role) : "/dashboard")
}
