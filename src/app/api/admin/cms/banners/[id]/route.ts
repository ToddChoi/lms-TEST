import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '../../../_guard'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { id } = params
  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.title       !== undefined) update.title       = body.title
  if (body.image_url   !== undefined) update.image_url   = body.image_url || null
  if (body.link_url    !== undefined) update.link_url    = body.link_url || null
  if (body.link_target !== undefined) update.link_target = body.link_target
  if (body.sort_order  !== undefined) update.sort_order  = body.sort_order
  if (body.is_visible  !== undefined) update.is_visible  = body.is_visible
  if (body.starts_at   !== undefined) update.starts_at   = body.starts_at || null
  if (body.ends_at     !== undefined) update.ends_at     = body.ends_at || null

  const { error } = await supabase!.from('banners').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { error } = await supabase!.from('banners').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/')
  return NextResponse.json({ success: true })
}
