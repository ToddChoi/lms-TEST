import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

function makeSupabase() {
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

async function checkAdmin(supabase: ReturnType<typeof makeSupabase>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) return null
  return user
}

export async function GET(_req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: rawSettings } = await supabase
    .from('site_settings')
    .select('key, value')
  const settings = rawSettings as unknown as { key: string; value: string }[] | null

  const result: Record<string, string> = {}
  ;(settings ?? []).forEach((s) => { result[s.key] = s.value })

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()

  const upsertRows = Object.entries(body).map(([key, value]) => ({
    key,
    value: String(value ?? ''),
  }))

  if (upsertRows.length === 0) return NextResponse.json({ success: true })

  const { error } = await (supabase as any)
    .from('site_settings')
    .upsert(upsertRows, { onConflict: 'key' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
