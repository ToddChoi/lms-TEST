/**
 * 회사 컬렉션 CRUD — 회사 컨텍스트 안에서.
 *
 * GET    /api/admin/companies/[id]/collections             → 그 회사의 모든 컬렉션
 * POST   /api/admin/companies/[id]/collections             → { name, description?, course_ids? }
 * PATCH  /api/admin/companies/[id]/collections             → { id, ...updates }
 * DELETE /api/admin/companies/[id]/collections             → { id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../../_guard'

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { data, error } = await supabase
    .from('company_course_collections')
    .select('*')
    .eq('company_id', params.id)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ collections: data ?? [] })
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { name, description, course_ids } = body as {
    name?: string
    description?: string
    course_ids?: string[]
  }
  if (!name?.trim()) return NextResponse.json({ error: 'name 필수' }, { status: 400 })

  const { data, error } = await (supabase as any)
    .from('company_course_collections')
    .insert({
      company_id: params.id,
      name: name.trim(),
      description: description ?? null,
      course_ids: course_ids ?? [],
    })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ collection: data }, { status: 201 })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, ...updates } = body as { id?: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const ALLOWED = ['name', 'description', 'course_ids', 'sort_order', 'is_active']
  const sanitized: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in updates) sanitized[k] = updates[k]

  const { error } = await (supabase as any)
    .from('company_course_collections')
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
    .from('company_course_collections')
    .delete()
    .eq('id', id)
    .eq('company_id', params.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
