"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { createClient } from "@/lib/supabase/server"
import { homePathForRole } from "@/lib/auth"

export type AuthState = { error?: string; message?: string }

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(1, "Password is required."),
})

const signupSchema = z.object({
  fullName: z.string().min(2, "Please enter your full name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  phone: z.string().optional(),
  // NOTE: allowing role selection at sign-up is a bootstrap convenience so the
  // first admin/teacher accounts can be created. In production, lock public
  // sign-up to 'parent' and have admins create staff via the Admin console.
  role: z.enum(["admin", "teacher", "parent"]).default("parent"),
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

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .single()

  revalidatePath("/", "layout")
  redirect(data?.role ? homePathForRole(data.role) : "/dashboard")
}

export async function signup(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    phone: formData.get("phone") || undefined,
    role: formData.get("role") || "parent",
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." }
  }

  const { email, password, fullName, phone, role } = parsed.data
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName, phone: phone ?? null, role },
    },
  })
  if (error) {
    return { error: error.message }
  }

  // If email confirmation is disabled, we get a session immediately.
  if (data.session) {
    revalidatePath("/", "layout")
    redirect(homePathForRole(role))
  }

  return {
    message:
      "Account created. Please check your email to confirm, then sign in.",
  }
}

export async function signout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/login")
}
