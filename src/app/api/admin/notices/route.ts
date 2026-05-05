import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { title, content, is_pinned, is_active } = body

  if (!title?.trim()) return NextResponse.json({ error: '제목은 필수입니다.' }, { status: 400 })

  const { data: rawNotice, error } = await (supabase as any)
    .from('notices')
    .insert({ title, content: content ?? null, is_pinned: is_pinned ?? false, is_active: is_active ?? true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const notice = rawNotice as unknown as object
  return NextResponse.json({ notice })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, title, content, is_pinned, is_active } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (content !== undefined) updateData.content = content
  if (is_pinned !== undefined) updateData.is_pinned = is_pinned
  if (is_active !== undefined) updateData.is_active = is_active

  const { error } = await (supabase as any)
    .from('notices')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('notices')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
