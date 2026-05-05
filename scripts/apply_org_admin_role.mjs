/**
 * migration_org_admin_role.sql 적용
 *  - profiles.role CHECK 확장
 *  - manager@demo.com role 'org_admin' 으로 변경
 */
import { sb } from './_env.mjs'

const sb = createClient(
  'https://unrhoadjtyyuqvtdeyks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// CHECK 제약은 service_role 로도 일반 from() 으로는 변경 불가 → SQL 실행 필요.
// 하지만 update 자체는 가능. 따라서 사용자에게 SQL 실행 안내 후 update 만 처리.
// 또는 service_role + REST RPC 로 raw SQL 가능.
// → 가장 간단: rpc('exec_sql') 같은 함수가 없으니, profiles UPDATE 만 시도하고
//    CHECK 제약 위반이면 사용자에게 SQL 먼저 실행하라고 안내.

console.log('manager@demo.com role 변경 시도...')
const { data, error } = await sb
  .from('profiles')
  .update({ role: 'org_admin' })
  .eq('email', 'manager@demo.com')
  .select('id, email, role')

if (error) {
  console.error('\n❌ 실패:', error.message)
  console.error('\n→ profiles_role_check 제약이 아직 org_admin 을 허용하지 않을 수 있습니다.')
  console.error('   먼저 supabase/migration_org_admin_role.sql 을 SQL Editor 에서 실행하세요.')
  process.exit(1)
}

console.log('✓ 변경 완료:', data)
