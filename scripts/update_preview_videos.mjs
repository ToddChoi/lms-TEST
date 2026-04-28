import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://unrhoadjtyyuqvtdeyks.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// 강좌 슬러그별 미리보기 영상 (공개 YouTube 영상, 실제 관련 콘텐츠)
const previewVideos = {
  'chatgpt-productivity': 'https://www.youtube.com/watch?v=JTxsNm9IdYU',   // ChatGPT 소개
  'python-data-analysis': 'https://www.youtube.com/watch?v=r-uOLxNrNk8',   // Python 데이터 분석 입문
  'ai-image-generation':  'https://www.youtube.com/watch?v=SVcsDDABEkM',   // AI 이미지 생성
  'metaverse-business':   'https://www.youtube.com/watch?v=GegyHMKHqsA',   // 메타버스 소개
  'information-processing-engineer': 'https://www.youtube.com/watch?v=pGFGD5pnSAA', // 정보처리기사
}

// 강좌 조회
const { data: courses } = await supabase
  .from('courses')
  .select('id, slug')

for (const course of courses ?? []) {
  const videoUrl = previewVideos[course.slug]
  if (!videoUrl) continue

  // 해당 강좌의 is_preview=true 레슨 조회
  const { data: lessons } = await supabase
    .from('lessons')
    .select('id, title')
    .eq('course_id', course.id)
    .eq('is_preview', true)

  for (const lesson of lessons ?? []) {
    const { error } = await supabase
      .from('lessons')
      .update({ video_url: videoUrl })
      .eq('id', lesson.id)

    if (error) {
      console.error(`오류 (${lesson.title}):`, error.message)
    } else {
      console.log(`✓ [${course.slug}] ${lesson.title} → 영상 업데이트 완료`)
    }
  }
}

console.log('\n🎉 미리보기 영상 업데이트 완료!')
