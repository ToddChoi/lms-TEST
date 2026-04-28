import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

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

  const { data, error } = await (supabase as any)
    .from('home_sections')
    .select('*')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sections: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, is_visible, config, sort_order } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (is_visible !== undefined) updateData.is_visible = is_visible
  if (config !== undefined) updateData.config = config
  if (sort_order !== undefined) updateData.sort_order = sort_order

  const { error } = await (supabase as any)
    .from('home_sections')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ success: true })
}
