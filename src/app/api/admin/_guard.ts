import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export function makeSupabase() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )
}

export async function requireAdmin() {
  const supabase = makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { guard: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), supabase: null }
  }
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return { guard: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), supabase: null }
  }
  return { guard: null, supabase }
}
