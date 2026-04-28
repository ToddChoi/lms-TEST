import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '../../../_guard'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { id } = params
  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.label       !== undefined) update.label       = body.label
  if (body.title       !== undefined) update.title       = body.title
  if (body.subtitle    !== undefined) update.subtitle    = body.subtitle
  if (body.is_visible  !== undefined) update.is_visible  = body.is_visible
  if (body.sort_order  !== undefined) update.sort_order  = body.sort_order
  if (body.config      !== undefined) update.config      = body.config

  const { error } = await supabase!.from('home_sections').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { id } = params

  // banner 섹션 삭제 시 banners CASCADE 처리됨 (DB 레벨)
  const { error } = await supabase!.from('home_sections').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  return NextResponse.json({ success: true })
}
