import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '../../_guard'

export async function GET(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const location = req.nextUrl.searchParams.get('location')
  let query = supabase!.from('nav_menus').select('*').order('sort_order')
  if (location) query = query.eq('location', location) as typeof query

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ menus: data })
}

export async function POST(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { location, label, url, target, sort_order, is_visible } = body

  if (!label?.trim()) return NextResponse.json({ error: '메뉴 이름은 필수입니다.' }, { status: 400 })
  if (!url?.trim())   return NextResponse.json({ error: 'URL은 필수입니다.' }, { status: 400 })
  if (!['header', 'footer'].includes(location)) {
    return NextResponse.json({ error: 'location은 header 또는 footer이어야 합니다.' }, { status: 400 })
  }

  const { data, error } = await supabase!
    .from('nav_menus')
    .insert({ location, label, url, target: target ?? '_self', sort_order: sort_order ?? 0, is_visible: is_visible ?? true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/', 'layout')
  return NextResponse.json({ menu: data }, { status: 201 })
}
