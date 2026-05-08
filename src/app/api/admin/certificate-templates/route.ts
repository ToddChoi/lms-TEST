/**
 * 수료증 템플릿 CRUD.
 *
 * GET    list (모든 scope, admin 가시)
 * POST   create
 * PATCH  update
 * DELETE delete (단 is_default=true 인 마지막 템플릿은 보호 — 별도 라운드)
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function GET() {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { data, error } = await supabase
    .from('certificate_templates')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ templates: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const {
    name, description, page_size, page_orientation,
    background_color, background_url, elements,
    is_default, scope_type, company_id,
  } = body as Record<string, unknown>

  if (!name || typeof name !== 'string') {
    return NextResponse.json({ error: 'name 필수' }, { status: 400 })
  }

  // is_default=true 신규 시 기존 default 해제 (글로벌 only)
  if (is_default === true && (scope_type ?? 'global') === 'global') {
    await (supabase as any)
      .from('certificate_templates')
      .update({ is_default: false })
      .eq('is_default', true)
      .eq('scope_type', 'global')
  }

  const { data, error } = await (supabase as any)
    .from('certificate_templates')
    .insert({
      name,
      description: description ?? null,
      page_size: page_size ?? 'A4',
      page_orientation: page_orientation ?? 'landscape',
      background_color: background_color ?? '#FFFFFF',
      background_url: background_url ?? null,
      elements: elements ?? [],
      is_default: is_default ?? false,
      scope_type: scope_type ?? 'global',
      company_id: company_id ?? null,
    })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ template: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, ...updates } = body as { id?: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  // is_default 켜는 경우 다른 default 해제
  if (updates.is_default === true) {
    const { data: row } = await supabase
      .from('certificate_templates').select('scope_type').eq('id', id).maybeSingle()
    const scope = (row as unknown as { scope_type: string } | null)?.scope_type ?? 'global'
    if (scope === 'global') {
      await (supabase as any)
        .from('certificate_templates')
        .update({ is_default: false })
        .eq('is_default', true)
        .eq('scope_type', 'global')
        .neq('id', id)
    }
  }

  const ALLOWED = [
    'name', 'description', 'page_size', 'page_orientation',
    'background_color', 'background_url', 'elements',
    'is_default', 'scope_type', 'company_id',
  ]
  const sanitized: Record<string, unknown> = {}
  for (const k of ALLOWED) if (k in updates) sanitized[k] = updates[k]

  const { error } = await (supabase as any)
    .from('certificate_templates')
    .update(sanitized)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id } = body as { id?: string }
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  // is_default 보호 — 마지막 default 삭제 막음
  const { data: row } = await supabase
    .from('certificate_templates').select('is_default, scope_type').eq('id', id).maybeSingle()
  const r = row as unknown as { is_default: boolean; scope_type: string } | null
  if (r?.is_default && r.scope_type === 'global') {
    return NextResponse.json({
      error: '기본 템플릿은 삭제할 수 없습니다. 다른 템플릿을 기본으로 지정 후 삭제하세요.'
    }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from('certificate_templates')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
