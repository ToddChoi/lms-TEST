/**
 * Admin API — content_blocks CRUD + reorder.
 *
 * GET    ?surface=home          → 해당 surface 의 모든 블록 (status 무관)
 * POST   { surface, block_type, config?, sort_order? } → 신규 블록
 * PATCH  { id, config?, sort_order?, status?, audience?, starts_at?, ends_at? } → 일부 수정
 * DELETE { id }                 → 삭제
 *
 * 권한: admin/superadmin (P2). P3 에서 회사 관리자도 자기 company 범위 편집 가능하게 확장.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function GET(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const surface = req.nextUrl.searchParams.get('surface')
  if (!surface) {
    return NextResponse.json({ error: 'surface 쿼리 필요' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('content_blocks')
    .select('*')
    .eq('surface', surface)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ blocks: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { surface, block_type, config, sort_order, scope_type, company_id } = body as {
    surface?: string
    block_type?: string
    config?: Record<string, unknown>
    sort_order?: number
    scope_type?: 'global' | 'company'
    company_id?: string | null
  }

  if (!surface || !block_type) {
    return NextResponse.json({ error: 'surface, block_type 필수' }, { status: 400 })
  }

  // sort_order 미지정 시 같은 surface 의 max+10
  let order = sort_order
  if (typeof order !== 'number') {
    const { data: rawMax } = await supabase
      .from('content_blocks')
      .select('sort_order')
      .eq('surface', surface)
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle()
    const max = (rawMax as { sort_order: number } | null)?.sort_order ?? 0
    order = max + 10
  }

  const { data, error } = await (supabase as any)
    .from('content_blocks')
    .insert({
      surface,
      block_type,
      config: config ?? {},
      sort_order: order,
      scope_type: scope_type ?? 'global',
      company_id: company_id ?? null,
      status: 'draft',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ block: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, ...updates } = body as { id?: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  // 화이트리스트 — surface/block_type 변경은 신규 만들고 옛 거 지우는 게 안전
  const ALLOWED = ['config', 'sort_order', 'status', 'audience', 'starts_at', 'ends_at', 'scope_type', 'company_id']
  const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ALLOWED) if (k in updates) sanitized[k] = updates[k]

  const { error } = await (supabase as any)
    .from('content_blocks')
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

  const { error } = await (supabase as any)
    .from('content_blocks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
