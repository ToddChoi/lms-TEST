/**
 * P0 #5 — Storage 버킷 보안 점검
 *
 * course-videos 버킷이 public 으로 만들어졌는지 확인.
 * public 이면 수강 안 한 사람도 영상 URL 만 알면 시청 가능 (= 콘텐츠 보호 실패).
 *
 * 실행:  node scripts/check_storage_buckets.mjs
 * 종료코드: 위험 발견 시 1, 정상이면 0.
 */
import { sb } from './_env.mjs'

const EXPECTED = {
  // bucket name : expected public flag
  'course-videos': false,   // 수강생만 보게 하려면 private 이어야 함
  banners: true,            // 홈 배너는 공개여야 함
}

console.log('━━━ Supabase Storage 버킷 감사 ━━━\n')

const { data: buckets, error } = await sb.storage.listBuckets()
if (error) {
  console.error('❌ listBuckets 실패:', error.message)
  process.exit(1)
}

let problems = 0
const seen = new Set()

for (const b of buckets ?? []) {
  seen.add(b.name)
  const expected = EXPECTED[b.name]
  const tag = expected === undefined
    ? '·'
    : (b.public === expected ? '✓' : '⚠')
  const note = expected === undefined
    ? '(예상치 미정의)'
    : (b.public === expected ? '정상' : `★ 위험 — public=${b.public}, 기대값=${expected}`)
  console.log(`  ${tag} ${b.name.padEnd(20)} public=${String(b.public).padEnd(5)} ${note}`)
  if (expected !== undefined && b.public !== expected) problems++
}

// 누락 버킷
for (const [name, expected] of Object.entries(EXPECTED)) {
  if (!seen.has(name)) {
    console.log(`  ⚠ ${name.padEnd(20)} (없음) — 코드는 이 버킷 사용 중. Dashboard 에서 ${expected ? 'public' : 'private'} 으로 생성 필요.`)
    problems++
  }
}

console.log('')

if (problems > 0) {
  console.log(`★ ${problems}건 조치 필요`)
  console.log('')
  console.log('조치 (course-videos 가 public 이라면):')
  console.log('  1. Supabase Dashboard → Storage → course-videos → Settings')
  console.log('  2. "Public bucket" 토글 OFF')
  console.log('  3. 코드 변경: src/app/api/admin/videos/upload-url/route.ts 의 getPublicUrl → createSignedUrl')
  console.log('  4. 영상 재생 컴포넌트에서 매 재생 시 서버에 signed URL 요청하도록 변경')
  console.log('     (수강 권한 검증 후 짧은 TTL 의 signed URL 발급)')
  process.exit(1)
}

console.log('✓ 모든 버킷 정상')
