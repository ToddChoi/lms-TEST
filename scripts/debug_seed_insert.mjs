/**
 * 시드 강좌 INSERT 가 silent fail 한 정확한 원인 파악
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://unrhoadjtyyuqvtdeyks.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1) 강사1 + 카테고리 'data' id 가져오기
const { data: ins } = await sb.from('profiles').select('id').eq('email', 'instructor1@demo.com').single()
const { data: cat } = await sb.from('categories').select('id').eq('slug', 'data').single()
console.log('instructor1 id:', ins?.id)
console.log('category data id:', cat?.id)

// 2) 시드 스크립트와 동일한 INSERT 시도, 에러를 명시적으로 출력
const { data, error } = await sb.from('courses').insert({
  slug: 'demo-debug-test',
  title: 'DEBUG TEST',
  subtitle: 'should fail or succeed clearly',
  category_id: cat?.id,
  instructor_id: ins?.id,
  level: 'beginner',
  price: 0,
  badge: 'best',
  status: 'active',
  is_featured: true,
  thumbnail_url: null,
}).select().single()

console.log('\n=== INSERT 결과 ===')
console.log('data:', data)
console.log('error:', error)

// 3) 성공했으면 즉시 삭제 (테스트용이라)
if (data?.id) {
  await sb.from('courses').delete().eq('id', data.id)
  console.log('테스트 강좌 삭제 완료')
}
