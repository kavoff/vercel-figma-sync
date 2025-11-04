import { createClient as createAdminClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"

export async function createClient() {
  // Server-only Supabase client using Service Role key to bypass RLS in API routes.
  // Do NOT expose this key to the browser.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createAdminClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetch as any },
  })
}
