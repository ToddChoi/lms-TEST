/**
 * 회사 학습맵 CRUD.
 * GET/POST/PATCH/DELETE 패턴은 collections 와 동일.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../_guard'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { data, error } = await supabase
    .from('learning_paths')
    .select('*')
    .eq('company_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ paths: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { name, description, target_role, target_level, course_ids } = body as {
    name?: string
    description?: string
    target_role?: string
    target_level?: string
    course_ids?: string[]
  }
  if (!name?.trim()) return NextResponse.json({ error: 'name 필수' }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('learning_paths')
    .insert({
      company_id: params.id,
      name: name.trim(),
      description: description ?? null,
      target_role: target_role ?? null,
      target_level: target_level ?? null,
      course_ids: course_ids ?? [],
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ path: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, ...updates } = body as { id?: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const ALLOWED = ['name', 'description', 'target_role', 'target_level', 'course_ids', 'sort_order', 'is_active']
  const sanitized: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in updates) sanitized[k] = updates[k]

  const { error } = await (supabase as any)
    .from('learning_paths')
    .update(sanitized)
    .eq('id', id)
    .eq('company_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('learning_paths')
    .delete()
    .eq('id', id)
    .eq('company_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
