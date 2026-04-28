import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '../../../_guard'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { id } = params
  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.location   !== undefined) update.location   = body.location
  if (body.label      !== undefined) update.label      = body.label
  if (body.url        !== undefined) update.url        = body.url
  if (body.target     !== undefined) update.target     = body.target
  if (body.sort_order !== undefined) update.sort_order = body.sort_order
  if (body.is_visible !== undefined) update.is_visible = body.is_visible

  const { error } = await supabase!.from('nav_menus').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { error } = await supabase!.from('nav_menus').delete().eq('id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
