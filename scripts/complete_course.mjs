import { sb } from './_env.mjs'

// ── 1. 김지수 프로필 조회
const { data: profile } = await supabase
  .from('profiles').select('id, name').eq('email', 'kim.jisoo@test.com').single()
if (!profile) { console.error('김지수 계정을 찾을 수 없습니다.'); process.exit(1) }
console.log(`✓ 학습자: ${profile.name} (${profile.id})`)

// ── 2. 강좌 조회
const { data: course } = await supabase
  .from('courses').select('id, title').eq('slug', 'python-data-analysis').single()
if (!course) { console.error('강좌를 찾을 수 없습니다.'); process.exit(1) }
console.log(`✓ 강좌: ${course.title} (${course.id})`)

// ── 3. 수강 신청 (없으면 생성)
const { data: existingEnrollment } = await supabase
  .from('enrollments').select('id').eq('user_id', profile.id).eq('course_id', course.id).maybeSingle()

let enrollmentId
if (existingEnrollment) {
  enrollmentId = existingEnrollment.id
  console.log('✓ 기존 수강 신청 확인')
} else {
  const { data: newEnrollment, error } = await supabase
    .from('enrollments').insert({ user_id: profile.id, course_id: course.id, status: 'active' }).select('id').single()
  if (error) { console.error('수강 신청 실패:', error.message); process.exit(1) }
  enrollmentId = newEnrollment.id
  console.log('✓ 수강 신청 생성')
}

// ── 4. 강좌의 모든 레슨 조회
const { data: lessons } = await supabase
  .from('lessons').select('id, title, duration').eq('course_id', course.id)
if (!lessons?.length) { console.error('레슨이 없습니다.'); process.exit(1) }
console.log(`✓ 레슨 ${lessons.length}개 확인`)

// ── 5. 모든 레슨 진도 100% 처리
for (const lesson of lessons) {
  const { error } = await sb.from('lesson_progress').upsert({
    user_id: profile.id,
    lesson_id: lesson.id,
    course_id: course.id,
    watched_seconds: lesson.duration,
    is_completed: true,
    last_watched_at: new Date().toISOString(),
  }, { onConflict: 'user_id,lesson_id' })
  if (error) console.warn(`  ⚠ ${lesson.title}: ${error.message}`)
  else console.log(`  ✓ ${lesson.title} — 완료`)
}

// ── 6. 수강 상태 completed로 업데이트
await sb.from('enrollments').update({ status: 'completed' }).eq('id', enrollmentId)
console.log('✓ 수강 상태 → completed')

// ── 7. 수료증 발급
const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '')
const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
const certNumber = `CERT-${dateStr}-${rand}`

const { data: cert, error: certErr } = await supabase
  .from('certificates').insert({
    user_id: profile.id,
    course_id: course.id,
    cert_number: certNumber,
    issued_at: new Date().toISOString(),
  }).select('id').single()

if (certErr) { console.error('수료증 발급 실패:', certErr.message); process.exit(1) }

console.log(`\n🎓 수료증 발급 완료!`)
console.log(`  수료증 번호: ${certNumber}`)
console.log(`  확인 경로: http://localhost:3000/my/certificates`)
console.log(`  관리자 확인: http://localhost:3000/admin/certificates`)
