/**
 * 새 sb_ 키가 service_role 과 동등 권한인지 진단
 *  - URL 일치 확인
 *  - 키 형식 자동 분류 (_env.mjs 가 이미 1차 검증함)
 *  - 일반 select (RLS 영향 받음)
 *  - service_role 전용 admin API
 */
import { sb, SUPABASE_URL, SERVICE_ROLE_KEY, KEY_KIND } from './_env.mjs'

console.log('━━━ 환경 ━━━')
console.log('  URL          :', SUPABASE_URL)
console.log('  KEY 종류     :', KEY_KIND)
console.log('  KEY 시작 12자:', SERVICE_ROLE_KEY?.slice(0, 12))
console.log('  KEY 끝 4자   :', SERVICE_ROLE_KEY?.slice(-4))
console.log('  KEY 길이     :', SERVICE_ROLE_KEY?.length)

console.log('\n━━━ 테이블 SELECT 권한 ━━━')

const { count: courseCount, error: cerr } = await sb
  .from('courses').select('*', { count: 'exact', head: true })
console.log(`  courses          : ${courseCount ?? '?'} ${cerr ? `❌ ${cerr.message}` : '✓'}`)

const { count: pCount, error: perr } = await sb
  .from('profiles').select('*', { count: 'exact', head: true })
console.log(`  profiles         : ${pCount ?? '?'} ${perr ? `❌ ${perr.message}` : '✓'}`)

const { count: eCount, error: eerr } = await sb
  .from('enrollments').select('*', { count: 'exact', head: true })
console.log(`  enrollments      : ${eCount ?? '?'} ${eerr ? `❌ ${eerr.message}` : '✓'}`)

console.log('\n━━━ Auth Admin API 권한 (service_role 전용) ━━━')
const { data: usersList, error: uerr } = await sb.auth.admin.listUsers({ page: 1, perPage: 5 })
if (uerr) {
  console.log(`  ❌ ${uerr.message}`)
} else {
  console.log(`  ✓ 응답 받음 (사용자 ${usersList?.users?.length ?? 0}명)`)
}

console.log('\n━━━ 종합 진단 ━━━')
const totalUsers = usersList?.users?.length ?? 0
const adminApiOk = !uerr

if (KEY_KIND === 'sb_publishable') {
  // _env.mjs 가 이미 막아주지만 방어적
  console.log('  ❌ publishable 키. SECRET 키로 교체 필요.')
} else if (!adminApiOk) {
  console.log('  ❌ Auth Admin API 거부 → 이 키는 service_role 권한이 없습니다.')
  console.log('     → Dashboard → Project Settings → API Keys → "Secret keys" 탭')
  console.log('     → 기존 secret key 가 있다면 "Reveal" 후 복사,')
  console.log('       없으면 "+ Create new secret key" 로 생성 (Permission: 기본/all 선택).')
} else if (pCount === 0 && courseCount > 0) {
  console.log('  ⚠ courses 는 보이는데 profiles=0 → RLS 우회 안 되고 있음.')
  console.log('     → 같은 프로젝트인데 권한이 부족한 secret key 일 가능성.')
  console.log('       Dashboard 에서 "+ Create new secret key" 누르고 Permission 을 "all" 로 만들어 재발급.')
} else if (totalUsers === 0 && pCount === 0 && courseCount === 0) {
  console.log('  ⚠ 모든 것이 0 → 다른 Supabase 프로젝트의 키일 가능성.')
  console.log(`     → URL ${SUPABASE_URL} 의 Dashboard 에서 키를 다시 복사.`)
} else {
  console.log(`  ✓ 정상. (users=${totalUsers}, profiles=${pCount}, courses=${courseCount}, enrollments=${eCount})`)
}
