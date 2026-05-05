import { NextRequest, NextResponse } from 'next/server'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { requireAdmin } from '../../_guard'

// 서비스 롤 클라이언트 (Storage 정책 우회)
function makeAdminClient() {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/admin/videos/upload-url
// body: { courseId: string, fileName: string, contentType: string }
export async function POST(req: NextRequest) {
  const { guard } = await requireAdmin()
  if (guard) return guard

  // ── 2. 요청 파싱 ─────────────────────────────────────────────
  const body = await req.json()
  const { courseId, fileName, contentType } = body as {
    courseId: string
    fileName: string
    contentType: string
  }

  if (!courseId || !fileName) {
    return NextResponse.json({ error: 'courseId와 fileName이 필요합니다.' }, { status: 400 })
  }

  // ── 3. 파일명 정제 및 Storage 경로 생성 ─────────────────────
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${courseId}/${Date.now()}_${safeName}`

  // ── 4. 서비스 롤로 Signed Upload URL 발급 ───────────────────
  const admin = makeAdminClient()
  const { data, error } = await (admin as any).storage
    .from('course-videos')
    .createSignedUploadUrl(path)

  if (error || !data?.signedUrl) {
    console.error('Signed URL 발급 오류:', error)
    return NextResponse.json({ error: `업로드 URL 발급 실패: ${error?.message}` }, { status: 500 })
  }

  // ★ 보안: course-videos 는 private 버킷. publicUrl 은 더 이상 발급하지 않음.
  // frontend 는 `path` 를 video_url 로 저장하고, 재생 시점에 서버가
  // signed URL 로 변환해 노출함 (src/lib/storage/video.ts 참고).
  return NextResponse.json({
    signedUrl: data.signedUrl,
    path,
  })
}
