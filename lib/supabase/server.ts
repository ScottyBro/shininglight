import { cookies } from "next/headers"
import { createServerClient } from "@supabase/ssr"

import { publicEnv, serverEnv } from "@/lib/env"
import type { Database } from "@/lib/types/database"

/**
 * Server-side Supabase client bound to the request cookies. Subject to RLS
 * for the signed-in user. Use in Server Components, Route Handlers, and
 * Server Actions.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // `setAll` called from a Server Component. This can be ignored if
            // middleware is refreshing sessions (which it is).
          }
        },
      },
    }
  )
}

/**
 * Privileged client using the service-role key. BYPASSES RLS entirely.
 * Only use in trusted server code after you have verified the caller is an
 * admin. Never expose results directly without an authorization check.
 */
export function createAdminClient() {
  return createServerClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {
          // no-op: service client is not tied to a user session
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
