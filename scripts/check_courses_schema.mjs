import { sb } from './_env.mjs'

const sb = createClient(
  'https://unrhoadjtyyuqvtdeyks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// 가장 최근 강좌 1개 select * 해서 컬럼 보기
const { data } = await sb.from('courses').select('*').limit(1).maybeSingle()
console.log('courses 컬럼:', data ? Object.keys(data) : '강좌 없음')
