import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * 회사 매니저용 — 자사 정보 편집
 *
 * PUT /api/org/company
 * body: { id: string; name: string }
 *
 * 권한: 호출자가 해당 company 의 is_manager=true 인 경우만.
 */
export async function PUT(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const { id, name } = body as { id: string; name: string }

  if (!id || !name?.trim())
    return NextResponse.json({ error: 'id 와 name 은 필수입니다.' }, { status: 400 })
  if (name.length > 100)
    return NextResponse.json({ error: '회사명은 100자 이내여야 합니다.' }, { status: 400 })

  // ★ C3/C4: role + is_manager 이중 게이트
  const { data: rawMyProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const myRole = (rawMyProfile as { role: string } | null)?.role
  if (!myRole || !['org_admin', 'admin', 'superadmin'].includes(myRole)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 매니저 권한 확인
  const { data: rawMembership } = await supabase
    .from('company_members')
    .select('is_manager')
    .eq('user_id', user.id)
    .eq('company_id', id)
    .maybeSingle()
  const membership = rawMembership as unknown as { is_manager: boolean } | null
  if (!membership?.is_manager) {
    return NextResponse.json({ error: '해당 회사의 매니저가 아닙니다.' }, { status: 403 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('companies')
    .update({ name: name.trim() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
