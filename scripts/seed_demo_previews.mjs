/**
 * 데모 강좌 일부에 미리보기 영상(mp4/YouTube) 추가
 * - 카드 호버 자동재생용 (mp4) + 강좌 상세 미리보기 모달용 (YouTube 가능)
 */

import { sb } from './_env.mjs'

const sb = createClient(
  'https://unrhoadjtyyuqvtdeyks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Google Cloud 무료 호스팅 mp4 (Big Buck Bunny / Sintel — public domain)
const SAMPLE_MP4 = [
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
  'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
]
// YouTube — 모달 미리보기에선 잘 동작
const SAMPLE_YT = [
  'https://www.youtube.com/watch?v=arj7oStGLkU', // TED
  'https://www.youtube.com/watch?v=8jPQjjsBbIc', // TED-Ed
]

const ASSIGN = [
  { slug: 'demo-sql-basics',     url: SAMPLE_MP4[0] },  // mp4 — 호버 시 자동재생
  { slug: 'demo-marketing-101',  url: SAMPLE_MP4[1] },  // mp4
  { slug: 'demo-react-intro',    url: SAMPLE_MP4[2] },  // mp4
  { slug: 'demo-chatgpt-work',   url: SAMPLE_YT[0] },   // YouTube — 모달용
  { slug: 'demo-onboarding',     url: SAMPLE_YT[1] },   // YouTube
]

console.log('━━━ preview_url 매핑 ━━━')
let count = 0
for (const a of ASSIGN) {
  const { data, error } = await sb
    .from('courses')
    .update({ preview_url: a.url })
    .eq('slug', a.slug)
    .select('id')
  if (error) console.error(`  ✗ ${a.slug}: ${error.message}`)
  else if (data && data.length > 0) { count++; console.log(`  ✓ ${a.slug}`) }
  else console.log(`  · ${a.slug} (강좌 없음)`)
}
console.log(`\n${count}/${ASSIGN.length} 매핑 완료`)
