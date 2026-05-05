/**
 * Admin API — pages CRUD.
 *
 * pages 테이블: 약관, 개인정보처리방침, 환불정책, 회사 전용 랜딩 등.
 * body 는 일단 plain text / markdown — WYSIWYG 은 다음 라운드.
 *
 * GET    /api/admin/pages          → 모든 페이지 list
 * POST   /api/admin/pages          → { slug, title, body?, status?, scope_type?, company_id? }
 * PATCH  /api/admin/pages          → { id, ...updates }
 * DELETE /api/admin/pages          → { id }
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function GET() {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ pages: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { guard, supabase: sb, user } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const {
    slug, title, body: pageBody, status, scope_type, company_id, seo,
  } = body as {
    slug?: string
    title?: string
    body?: string
    status?: 'draft' | 'published'
    scope_type?: 'global' | 'company'
    company_id?: string | null
    seo?: Record<string, unknown>
  }
  if (!slug || !title) return NextResponse.json({ error: 'slug, title 필수' }, { status: 400 })

  const insertRow = {
    slug,
    title,
    body: pageBody ?? null,
    status: status ?? 'draft',
    scope_type: scope_type ?? 'global',
    company_id: company_id ?? null,
    seo: seo ?? {},
    author_id: user?.id ?? null,
    published_at: status === 'published' ? new Date().toISOString() : null,
  }

  const { data, error } = await (supabase as any)
    .from('pages')
    .insert(insertRow)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ page: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, ...updates } = body as { id?: string } & Record<string, unknown>
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const ALLOWED = ['slug', 'title', 'body', 'status', 'scope_type', 'company_id', 'seo']
  const sanitized: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ALLOWED) if (k in updates) sanitized[k] = updates[k]

  // status='published' 로 바뀌면 published_at 도 자동 세팅
  if (updates.status === 'published') {
    sanitized.published_at = new Date().toISOString()
  }

  const { error } = await (supabase as any).from('pages').update(sanitized).eq('id', id)

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

  const { error } = await (supabase as any).from('pages').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
