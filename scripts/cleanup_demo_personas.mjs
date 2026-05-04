/**
 * 데모 페르소나 시드 정리 — 시연이 끝났을 때 사용
 *
 * 삭제 범위:
 *  - 이메일이 *@demo.com 인 모든 계정 + profiles + enrollments + lesson_progress + reviews + Q&A + certs
 *  - slug 이 demo-* 인 모든 강좌 + sections + lessons
 *  - "데모 주식회사" companies + company_members
 *  - slug 이 data/marketing/dev/ai/hr 인 카테고리는 **유지** (운영에서 재사용 가능)
 *
 * 실행:
 *   node scripts/cleanup_demo_personas.mjs
 *
 * ⚠️ 운영 데이터에는 영향 없음 — 위 패턴에 매치되는 것만 삭제.
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://unrhoadjtyyuqvtdeyks.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('═══════════════════════════════════════════')
  console.log('  Demo Cleanup — *@demo.com / demo-* slug')
  console.log('═══════════════════════════════════════════\n')

  // 1) 데모 강좌 ID 수집 → CASCADE 로 sections/lessons/enrollments/progress/reviews/qa/certs 다 삭제
  const { data: demoCourses } = await supabase
    .from('courses').select('id, slug').like('slug', 'demo-%')
  const courseIds = (demoCourses ?? []).map((c) => c.id)
  console.log(`강좌 ${courseIds.length}개 발견`)

  if (courseIds.length > 0) {
    const { error } = await supabase.from('courses').delete().in('id', courseIds)
    if (error) console.error('  ✗ courses:', error.message)
    else console.log(`  ✓ 강좌 + 관련 데이터 (CASCADE) 삭제`)
  }

  // 2) 회사 삭제
  const { error: companyErr } = await supabase
    .from('companies').delete().eq('name', '데모 주식회사')
  if (companyErr) console.error('  ✗ company:', companyErr.message)
  else console.log(`  ✓ 데모 주식회사 + 멤버 삭제`)

  // 3) 데모 계정 삭제 (auth.users + CASCADE)
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const demoUsers = (existing?.users ?? []).filter((u) => u.email?.endsWith('@demo.com'))
  console.log(`계정 ${demoUsers.length}개 발견`)

  let deleted = 0
  for (const u of demoUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id)
    if (error) console.error(`  ✗ ${u.email}: ${error.message}`)
    else deleted++
  }
  console.log(`  ✓ ${deleted}/${demoUsers.length} 계정 삭제`)

  console.log('\n✅ Cleanup 완료')
  console.log('   카테고리(data/marketing/dev/ai/hr)는 유지됨 — 필요 시 관리자 화면에서 직접 삭제하세요.')
}

main().catch((e) => {
  console.error('❌ Cleanup failed:', e)
  process.exit(1)
})
