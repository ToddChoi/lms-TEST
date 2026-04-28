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
    .from('banners')
    .select('*')
    .order('sort_order', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banners: data })
}

export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { title, image_url, link_url, link_target, sort_order, is_active, starts_at, ends_at } = body

  if (!image_url?.trim()) return NextResponse.json({ error: '이미지 URL은 필수입니다.' }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('banners')
    .insert({
      title: title || null,
      image_url,
      link_url: link_url || null,
      link_target: link_target || '_self',
      sort_order: sort_order ?? 0,
      is_active: is_active ?? true,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ banner: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, title, image_url, link_url, link_target, sort_order, is_active, starts_at, ends_at } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title !== undefined) updateData.title = title || null
  if (image_url !== undefined) updateData.image_url = image_url
  if (link_url !== undefined) updateData.link_url = link_url || null
  if (link_target !== undefined) updateData.link_target = link_target
  if (sort_order !== undefined) updateData.sort_order = sort_order
  if (is_active !== undefined) updateData.is_active = is_active
  if (starts_at !== undefined) updateData.starts_at = starts_at || null
  if (ends_at !== undefined) updateData.ends_at = ends_at || null

  const { error } = await (supabase as any)
    .from('banners')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('banners')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ success: true })
}
