import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { course_id, title, sort_order } = body

  if (!course_id || !title?.trim()) {
    return NextResponse.json({ error: 'course_id와 title은 필수입니다.' }, { status: 400 })
  }

  const { data: rawSection, error } = await (supabase as any)
    .from('sections')
    .insert({ course_id, title, sort_order: sort_order ?? 0 })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const section = rawSection as unknown as object
  return NextResponse.json({ section })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, title, sort_order } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (title !== undefined) updateData.title = title
  if (sort_order !== undefined) updateData.sort_order = sort_order

  const { error } = await (supabase as any)
    .from('sections')
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

  // Delete lessons first (cascade should handle it, but explicit for safety)
  await (supabase as any).from('lessons').delete().eq('section_id', id)

  const { error } = await (supabase as any)
    .from('sections')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
