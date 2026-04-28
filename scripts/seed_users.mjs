import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://unrhoadjtyyuqvtdeyks.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

const users = [
  { email: 'kim.jisoo@test.com',   name: '김지수', company: '삼성전자',   department: '개발팀' },
  { email: 'lee.minho@test.com',   name: '이민호', company: 'LG전자',     department: '마케팅팀' },
  { email: 'park.soyeon@test.com', name: '박소연', company: '카카오',     department: '기획팀' },
  { email: 'choi.junho@test.com',  name: '최준호', company: '네이버',     department: '데이터팀' },
  { email: 'jung.hayeon@test.com', name: '정하연', company: '쿠팡',       department: '운영팀' },
]

for (const u of users) {
  // 1. auth 계정 생성 (이메일 인증 없이 바로 확인 처리)
  const { data, error } = await supabase.auth.admin.createUser({
    email: u.email,
    password: 'Test1234!',
    email_confirm: true,
    user_metadata: { name: u.name },
  })

  if (error) {
    console.error(`❌ ${u.name} (${u.email}): ${error.message}`)
    continue
  }

  // 2. profiles 업데이트 (company, department)
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({ company: u.company, department: u.department })
    .eq('id', data.user.id)

  if (profileErr) {
    console.warn(`⚠️  ${u.name} 프로필 업데이트 실패: ${profileErr.message}`)
  } else {
    console.log(`✓ ${u.name} | ${u.email} | ${u.company} ${u.department}`)
  }
}

console.log('\n🎉 학습자 계정 생성 완료!')
console.log('공통 비밀번호: Test1234!')
