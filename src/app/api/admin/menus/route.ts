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
    .from('menus')
    .select('*')
    .order('menu_type')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ menus: data })
}

export async function POST(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { label, href, menu_type, sort_order, target, is_active } = body

  if (!label?.trim()) return NextResponse.json({ error: '메뉴 이름은 필수입니다.' }, { status: 400 })
  if (!href?.trim()) return NextResponse.json({ error: '링크 URL은 필수입니다.' }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('menus')
    .insert({
      label,
      href,
      menu_type: menu_type || 'header',
      sort_order: sort_order ?? 0,
      target: target || '_self',
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/', 'layout')
  return NextResponse.json({ menu: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id, label, href, menu_type, sort_order, target, is_active } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (label !== undefined) updateData.label = label
  if (href !== undefined) updateData.href = href
  if (menu_type !== undefined) updateData.menu_type = menu_type
  if (sort_order !== undefined) updateData.sort_order = sort_order
  if (target !== undefined) updateData.target = target
  if (is_active !== undefined) updateData.is_active = is_active

  const { error } = await (supabase as any)
    .from('menus')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = makeSupabase()
  if (!await checkAdmin(supabase)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('menus')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
