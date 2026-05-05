/**
 * 데모 시드 + 권한 구조 진단 스크립트
 * 시연 전 데이터·권한이 의도대로 세팅됐는지 확인.
 *
 * 실행:
 *   node scripts/diagnose_demo.mjs
 */

import { sb } from './_env.mjs'

async function section(title, fn) {
  console.log(`\n━━━ ${title} ━━━`)
  try { await fn() } catch (e) { console.error('  ✗', e.message) }
}

await section('1. 데모 계정 + role', async () => {
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const demoUsers = (users?.users ?? []).filter((u) => u.email?.endsWith('@demo.com'))
  console.log(`  계정 수: ${demoUsers.length}`)
  for (const u of demoUsers) {
    const { data: p } = await sb.from('profiles').select('name, role').eq('id', u.id).maybeSingle()
    console.log(`    ${u.email.padEnd(28)} | role=${p?.role ?? '?'} | name=${p?.name ?? '?'}`)
  }
})

await section('2. 카테고리', async () => {
  const { data, count } = await sb.from('categories').select('slug, name', { count: 'exact' })
  console.log(`  카테고리 수: ${count}`)
  for (const c of data ?? []) console.log(`    ${c.slug.padEnd(12)} | ${c.name}`)
})

await section('3. 강좌 (instructor 매핑 확인)', async () => {
  const { data: courses } = await sb
    .from('courses')
    .select('id, slug, title, instructor_id, status, level, price')
    .like('slug', 'demo-%')
    .order('slug')
  console.log(`  데모 강좌 수: ${courses?.length ?? 0}`)
  for (const c of courses ?? []) {
    let instructorName = '없음'
    if (c.instructor_id) {
      const { data: p } = await sb.from('profiles').select('name, email').eq('id', c.instructor_id).maybeSingle()
      instructorName = p ? `${p.name}(${p.email})` : `${c.instructor_id} (profile 없음)`
    }
    console.log(`    ${c.slug.padEnd(24)} | status=${c.status} | level=${c.level ?? '-'} | price=${c.price ?? '-'} | ★ instructor=${instructorName}`)
  }
})

await section('4. 강좌별 섹션 + 강의 수', async () => {
  const { data: courses } = await sb.from('courses').select('id, slug').like('slug', 'demo-%')
  for (const c of courses ?? []) {
    const { count: secCount } = await sb.from('sections').select('*', { count: 'exact', head: true }).eq('course_id', c.id)
    const { count: lesCount } = await sb.from('lessons').select('*', { count: 'exact', head: true }).eq('course_id', c.id)
    console.log(`    ${c.slug.padEnd(24)} | sections=${secCount} lessons=${lesCount}`)
  }
})

await section('5. 회사 + 멤버십', async () => {
  const { data: companies } = await sb.from('companies').select('id, name')
  for (const co of companies ?? []) {
    const { data: members } = await sb
      .from('company_members')
      .select('is_manager, user_id, profiles(name, email, role)')
      .eq('company_id', co.id)
    console.log(`  ${co.name} (id=${co.id})`)
    for (const m of members ?? []) {
      const p = m.profiles
      console.log(`    ${m.is_manager ? '★매니저' : ' 직원 '} | ${p?.email ?? '?'} (role=${p?.role ?? '?'})`)
    }
  }
})

await section('6. 수강 신청 (enrollments)', async () => {
  // 데모 사용자 + 데모 강좌 한정
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const demoUserIds = (users?.users ?? []).filter((u) => u.email?.endsWith('@demo.com')).map((u) => u.id)

  const { data: enrolls } = await sb
    .from('enrollments')
    .select('user_id, course_id, status, enrolled_at')
    .in('user_id', demoUserIds)
  console.log(`  데모 수강 신청 수: ${enrolls?.length ?? 0}`)

  // user / course 매핑 캐시
  const { data: profiles } = await sb.from('profiles').select('id, email, name').in('id', demoUserIds)
  const userMap = new Map((profiles ?? []).map((p) => [p.id, p]))
  const courseIds = [...new Set((enrolls ?? []).map((e) => e.course_id))]
  const { data: courses } = await sb.from('courses').select('id, title, slug').in('id', courseIds)
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c]))

  for (const e of enrolls ?? []) {
    const u = userMap.get(e.user_id)
    const c = courseMap.get(e.course_id)
    console.log(`    ${(u?.name ?? '?').padEnd(8)} (${(u?.email ?? '?').padEnd(24)}) → ${c?.title ?? '?'} | status=${e.status}`)
  }
})

await section('7. 진도 (lesson_progress)', async () => {
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const demoUsers = (users?.users ?? []).filter((u) => u.email?.endsWith('@demo.com'))

  for (const u of demoUsers) {
    const { count: total } = await sb.from('lesson_progress').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
    const { count: done } = await sb.from('lesson_progress').select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('is_completed', true)
    if (total) console.log(`    ${u.email.padEnd(28)} | progress rows=${total} | completed=${done}`)
  }
})

await section('8. 수강평 + Q&A + 수료증', async () => {
  const [{ count: rev }, { count: q }, { count: a }, { count: cert }] = await Promise.all([
    sb.from('course_reviews').select('*', { count: 'exact', head: true }),
    sb.from('course_questions').select('*', { count: 'exact', head: true }),
    sb.from('course_answers').select('*', { count: 'exact', head: true }),
    sb.from('certificates').select('*', { count: 'exact', head: true }),
  ])
  console.log(`  course_reviews: ${rev} / questions: ${q} / answers: ${a} / certificates: ${cert}`)
})

await section('9. 권한 구조 — 강사 RLS 시뮬레이션', async () => {
  // 강사1로 로그인했을 때 보일 강좌 수 (instructor_id = 본인 + status='active')
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const ins1 = (users?.users ?? []).find((u) => u.email === 'instructor1@demo.com')
  if (!ins1) { console.log('  instructor1 없음'); return }
  const { count } = await sb.from('courses').select('*', { count: 'exact', head: true }).eq('instructor_id', ins1.id)
  console.log(`  instructor1 담당 강좌 수: ${count}`)
})

await section('10. 권한 구조 — B2B 매니저', async () => {
  const { data: users } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const mgr = (users?.users ?? []).find((u) => u.email === 'manager@demo.com')
  if (!mgr) { console.log('  manager 없음'); return }
  const { data: profile } = await sb.from('profiles').select('role').eq('id', mgr.id).maybeSingle()
  const { data: membership } = await sb.from('company_members')
    .select('is_manager, companies(name)')
    .eq('user_id', mgr.id)
  console.log(`  manager.role = ${profile?.role}`)
  console.log(`  manager memberships:`)
  for (const m of membership ?? []) {
    console.log(`    ${m.is_manager ? '★매니저' : '직원'} of "${m.companies?.name}"`)
  }
})

console.log('\n진단 완료.')
