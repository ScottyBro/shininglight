import { NextResponse, type NextRequest } from "next/server"
import { createServerClient } from "@supabase/ssr"

import { publicEnv } from "@/lib/env"
import type { Database } from "@/lib/types/database"

/**
 * Refreshes the Supabase auth session on every request and performs coarse
 * route protection. Fine-grained authorization is enforced by RLS in the
 * database and by per-page role checks.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: do not run code between createServerClient and getUser().
  // Bounded so a slow/unreachable Supabase can never hang the whole site:
  // Vercel Edge Middleware has a hard ~25s invocation timeout, and blowing
  // past it turns into a 504 for every request. Timing out here instead
  // degrades to "treat as signed out" for routing purposes only — RLS still
  // protects the data regardless, so this never widens access.
  const user = await Promise.race([
    supabase.auth.getUser().then((r) => r.data.user),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
  ])

  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname.startsWith("/login") ||
    pathname.startsWith("/signup") ||
    pathname.startsWith("/forgot-password")
  const isPublicRoute =
    isAuthRoute ||
    pathname === "/" ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/api/health") ||
    // Reachable via a password-recovery email link, which establishes a
    // session — must NOT be swept up by the "already signed in" redirect
    // below the way /login and /signup are.
    pathname.startsWith("/reset-password")

  // Unauthenticated user trying to reach a protected route -> login.
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    url.searchParams.set("redirectedFrom", pathname)
    return NextResponse.redirect(url)
  }

  // Authenticated user on an auth route -> send to their dashboard entry.
  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    url.search = ""
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
