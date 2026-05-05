import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * 회사 매니저용 — 자사 직원에게 강좌 일괄 신청
 *
 * POST /api/org/bulk-enroll
 * body: { memberIds: string[]; courseIds: string[] }
 *
 * 권한:
 *  - 호출자가 어떤 회사의 is_manager=true 여야 함
 *  - memberIds 는 모두 같은 회사 소속이어야 함 (다른 회사 사용자 등록 차단)
 *  - 무료 강좌만 자동 등록 (유료는 결제 흐름 필요 → 차단)
 *
 * 결과: 신규 등록된 enrollments 수 + 이미 있어서 건너뛴 수
 */
export async function POST(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const memberIds = (body.memberIds ?? []) as string[]
  const courseIds = (body.courseIds ?? []) as string[]

  if (!Array.isArray(memberIds) || memberIds.length === 0)
    return NextResponse.json({ error: '직원을 선택해주세요.' }, { status: 400 })
  if (!Array.isArray(courseIds) || courseIds.length === 0)
    return NextResponse.json({ error: '강좌를 선택해주세요.' }, { status: 400 })

  // ★ C3/C4: role + is_manager 둘 다 검사. role 만 검사하면 demote 후 is_manager
  // 잔류로 우회 가능, is_manager 만 검사하면 student 가 잘못 인서트되면 통과 가능.
  const { data: rawMyProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const myRole = (rawMyProfile as { role: string } | null)?.role
  if (!myRole || !['org_admin', 'admin', 'superadmin'].includes(myRole)) {
    return NextResponse.json({ error: '회사 매니저 권한이 없습니다.' }, { status: 403 })
  }

  const { data: rawMyMember } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', user.id)
    .eq('is_manager', true)
    .limit(1)
    .maybeSingle()
  const myMember = rawMyMember as unknown as { company_id: string } | null
  if (!myMember) {
    return NextResponse.json({ error: '회사 매니저 권한이 없습니다.' }, { status: 403 })
  }

  // 직원들이 같은 회사 소속인지 검증
  const { data: rawCompanyMembers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', myMember.company_id)
    .in('user_id', memberIds)
  const validMemberIds = ((rawCompanyMembers as unknown as { user_id: string }[] | null) ?? [])
    .map((m) => m.user_id)
  const invalidIds = memberIds.filter((id) => !validMemberIds.includes(id))
  if (invalidIds.length > 0) {
    return NextResponse.json(
      { error: `소속 직원이 아닌 사용자가 포함되어 있습니다 (${invalidIds.length}명)` },
      { status: 403 }
    )
  }

  // 무료 강좌만 (유료는 결제 흐름 필요)
  const { data: rawCourses } = await supabase
    .from('courses')
    .select('id, title, price, status')
    .in('id', courseIds)
  const courseRows = (rawCourses as unknown as
    { id: string; title: string; price: number; status: string }[] | null) ?? []
  const validCourses = courseRows.filter((c) => c.status === 'active' && c.price === 0)
  if (validCourses.length === 0) {
    return NextResponse.json(
      { error: '무료·활성 강좌만 일괄 신청 가능합니다. 유료 강좌는 결제 흐름이 필요합니다.' },
      { status: 400 }
    )
  }

  // 기존 enrollments 조회 — created/skipped 카운팅 용 (race-safe 검증은 upsert 가 함)
  const validCourseIds = validCourses.map((c) => c.id)
  const { data: rawExisting } = await supabase
    .from('enrollments')
    .select('user_id, course_id')
    .in('user_id', validMemberIds)
    .in('course_id', validCourseIds)
  const existingPairs = new Set(
    ((rawExisting as unknown as { user_id: string; course_id: string }[] | null) ?? [])
      .map((e) => `${e.user_id}:${e.course_id}`)
  )

  // 전체 조합 upsert — UNIQUE(user_id,course_id) 충돌 시 무시.
  // 이전 버전은 plain insert 라 한 건이라도 race 로 충돌하면 batch 전체 실패.
  const allRows: { user_id: string; course_id: string; status: string }[] = []
  for (const uid of validMemberIds) {
    for (const cid of validCourseIds) {
      allRows.push({ user_id: uid, course_id: cid, status: 'active' })
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: upsertErr } = await (supabase as any)
    .from('enrollments')
    .upsert(allRows, { onConflict: 'user_id,course_id', ignoreDuplicates: true })
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 })
  }

  const newPairs = allRows.filter((r) => !existingPairs.has(`${r.user_id}:${r.course_id}`)).length
  return NextResponse.json({
    ok: true,
    created: newPairs,
    skipped: allRows.length - newPairs,
  })
}
