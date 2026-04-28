import { createClient } from '@supabase/supabase-js'

// Service-role client — BYPASSES RLS. Use ONLY in server-side admin routes after role check.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
