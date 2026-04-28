import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function GET(_req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { data, error } = await supabase!
    .from('categories')
    .select('*')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ categories: data })
}

export async function POST(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { name, slug, description, icon, sort_order, is_visible } = body

  if (!name?.trim()) return NextResponse.json({ error: '이름은 필수입니다.' }, { status: 400 })

  const { data, error } = await supabase!
    .from('categories')
    .insert({
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9가-힣\s-]/g, '').replace(/\s+/g, '-'),
      description: description || null,
      icon: icon || null,
      sort_order: sort_order ?? 0,
      is_visible: is_visible ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ category: data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { id, name, slug, description, icon, sort_order, is_visible } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name        !== undefined) update.name        = name
  if (slug        !== undefined) update.slug        = slug
  if (description !== undefined) update.description = description || null
  if (icon        !== undefined) update.icon        = icon || null
  if (sort_order  !== undefined) update.sort_order  = sort_order
  if (is_visible  !== undefined) update.is_visible  = is_visible

  const { error } = await supabase!.from('categories').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase!.from('categories').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
