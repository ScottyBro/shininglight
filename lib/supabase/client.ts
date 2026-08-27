import { createBrowserClient } from "@supabase/ssr"

import { publicEnv } from "@/lib/env"
import type { Database } from "@/lib/types/database"

/**
 * Browser-side Supabase client. Uses the anon key and is subject to RLS.
 * Safe to use in Client Components.
 */
export function createClient() {
  return createBrowserClient<Database>(
    publicEnv.supabaseUrl,
    publicEnv.supabaseAnonKey
  )
}
