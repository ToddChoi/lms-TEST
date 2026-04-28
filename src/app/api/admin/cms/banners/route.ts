import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '../../_guard'

export async function GET(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const sectionId = req.nextUrl.searchParams.get('section_id')
  if (!sectionId) return NextResponse.json({ error: 'section_id is required' }, { status: 400 })

  const { data, error } = await supabase!
    .from('banners')
    .select('*')
    .eq('section_id', sectionId)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ banners: data })
}

export async function POST(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { section_id, title, image_url, link_url, link_target, sort_order, is_visible, starts_at, ends_at } = body

  if (!section_id) return NextResponse.json({ error: 'section_id는 필수입니다.' }, { status: 400 })

  const { data, error } = await supabase!
    .from('banners')
    .insert({
      section_id,
      title: title ?? '',
      image_url: image_url || null,
      link_url: link_url || null,
      link_target: link_target ?? '_self',
      sort_order: sort_order ?? 0,
      is_visible: is_visible ?? true,
      starts_at: starts_at || null,
      ends_at: ends_at || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ banner: data }, { status: 201 })
}
