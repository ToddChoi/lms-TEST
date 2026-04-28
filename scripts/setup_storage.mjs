import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://unrhoadjtyyuqvtdeyks.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

console.log('📦 course-videos 스토리지 버킷 설정 중...')

// ── 1. 버킷 생성 ────────────────────────────────────────────────
const { data: bucket, error: bucketErr } = await supabase.storage.createBucket('course-videos', {
  public: true,
  // free tier: 50MB, pro tier: 제한 없음
  fileSizeLimit: 52428800, // 50MB (free tier 기본값)
})

if (bucketErr) {
  if (bucketErr.message?.includes('already exists') || bucketErr.message?.includes('Duplicate')) {
    console.log('✓ 버킷이 이미 존재합니다 — 설정을 업데이트합니다.')

    const { error: updateErr } = await supabase.storage.updateBucket('course-videos', {
      public: true,
      fileSizeLimit: 52428800,
    })
    if (updateErr) console.warn('  ⚠ 업데이트 오류:', updateErr.message)
    else console.log('✓ 버킷 설정 업데이트 완료')
  } else {
    console.error('✗ 버킷 생성 실패:', bucketErr.message)
    process.exit(1)
  }
} else {
  console.log('✓ course-videos 버킷 생성 완료')
}

// ── 2. 버킷 확인 ────────────────────────────────────────────────
const { data: list } = await supabase.storage.listBuckets()
const found = list?.find((b) => b.name === 'course-videos')
if (found) {
  console.log(`✓ 버킷 확인: ${found.name} (public: ${found.public}, 용량 제한: ${Math.round((found.file_size_limit ?? 0) / 1024 / 1024)}MB)`)
} else {
  console.warn('⚠ 버킷 목록에서 찾을 수 없습니다.')
}

console.log('\n🎉 스토리지 설정 완료!')
console.log('   이제 강의 커리큘럼에서 영상 파일을 직접 업로드할 수 있습니다.')
