import { NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * 회사 매니저용 — 자사 학습 통계 CSV 내보내기
 *
 * GET /api/org/csv
 *
 * 행: (직원명, 이메일, 강좌명, 카테고리, 상태, 진도율%, 신청일, 수료여부)
 * 한글 안 깨지게 UTF-8 BOM 포함.
 */
export async function GET() {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  // ★ C3/C4: role + is_manager 이중 게이트
  const { data: rawMyProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const myRole = (rawMyProfile as { role: string } | null)?.role
  if (!myRole || !['org_admin', 'admin', 'superadmin'].includes(myRole)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  // 매니저 회사
  const { data: rawMembership } = await supabase
    .from('company_members')
    .select('company_id, companies(name)')
    .eq('user_id', user.id)
    .eq('is_manager', true)
    .limit(1)
    .maybeSingle()
  const m = rawMembership as unknown as {
    company_id: string
    companies: { name: string } | null
  } | null
  if (!m) return NextResponse.json({ error: '회사 매니저 권한이 없습니다.' }, { status: 403 })

  // 자사 직원
  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('user_id, profiles(name, email)')
    .eq('company_id', m.company_id)
  const memberRows = (rawMembers as unknown as {
    user_id: string
    profiles: { name: string | null; email: string | null } | null
  }[] | null) ?? []
  const memberIds = memberRows.map((r) => r.user_id)
  const memberMap = new Map(memberRows.map((r) => [r.user_id, r.profiles]))

  if (memberIds.length === 0) {
    const empty = '﻿직원명,이메일,강좌명,카테고리,상태,진도율(%),신청일,수료여부\n'
    return new Response(empty, {
      headers: csvHeaders('org_statistics_empty.csv'),
    })
  }

  // 수강 신청 + 강좌 메타
  const { data: rawEnrolls } = await supabase
    .from('enrollments')
    .select('user_id, course_id, status, enrolled_at, courses(title, categories(name))')
    .in('user_id', memberIds)
    .order('enrolled_at', { ascending: false })
  const enrollRows = (rawEnrolls as unknown as {
    user_id: string; course_id: string; status: string; enrolled_at: string
    courses: { title: string; categories: { name: string } | null } | null
  }[] | null) ?? []

  // 진도율 계산용 — 강좌별 전체 lesson 수, 사용자별 완료 수
  const courseIds = [...new Set(enrollRows.map((e) => e.course_id))]
  const lessonCountMap = new Map<string, number>()
  const completedMap = new Map<string, number>() // key: `${user_id}:${course_id}`

  if (courseIds.length > 0) {
    const [{ data: rawLessons }, { data: rawDone }] = await Promise.all([
      supabase.from('lessons').select('course_id').in('course_id', courseIds),
      supabase.from('lesson_progress').select('user_id, course_id')
        .eq('is_completed', true)
        .in('user_id', memberIds)
        .in('course_id', courseIds),
    ])
    const lessons = (rawLessons as unknown as { course_id: string }[] | null) ?? []
    const done = (rawDone as unknown as { user_id: string; course_id: string }[] | null) ?? []
    for (const l of lessons) lessonCountMap.set(l.course_id, (lessonCountMap.get(l.course_id) ?? 0) + 1)
    for (const d of done) {
      const key = `${d.user_id}:${d.course_id}`
      completedMap.set(key, (completedMap.get(key) ?? 0) + 1)
    }
  }

  const STATUS_LABEL: Record<string, string> = {
    active: '수강중', completed: '수료', expired: '만료', cancelled: '취소',
  }

  // CSV 빌드
  const escape = (v: string | number | null | undefined): string => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }

  const header = ['직원명', '이메일', '강좌명', '카테고리', '상태', '진도율(%)', '신청일', '수료여부']
  const rows = enrollRows.map((e) => {
    const profile = memberMap.get(e.user_id)
    const total = lessonCountMap.get(e.course_id) ?? 0
    const done = completedMap.get(`${e.user_id}:${e.course_id}`) ?? 0
    const pct = total > 0 ? Math.round((done / total) * 100) : 0
    return [
      profile?.name ?? '',
      profile?.email ?? '',
      e.courses?.title ?? '',
      e.courses?.categories?.name ?? '',
      STATUS_LABEL[e.status] ?? e.status,
      pct,
      e.enrolled_at?.slice(0, 10) ?? '',
      e.status === 'completed' ? 'O' : '',
    ]
  })

  const csv = '﻿' + [header, ...rows].map((r) => r.map(escape).join(',')).join('\n')

  const today = new Date().toISOString().slice(0, 10)
  const safeName = (m.companies?.name ?? 'company').replace(/[^a-zA-Z0-9가-힣\-_]/g, '_')
  return new Response(csv, {
    headers: csvHeaders(`${safeName}_${today}_statistics.csv`),
  })
}

function csvHeaders(filename: string): HeadersInit {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
    'Cache-Control': 'no-store',
  }
}
