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
//
// 보안 (P2.3):
//  - 클라이언트 검증은 우회 가능 → 서버에서도 MIME / 확장자 / 파일명 길이 검증.
//  - allowlist 외 거부.
const ALLOWED_MIME = new Set([
  'video/mp4', 'video/webm', 'video/quicktime',
  'video/x-matroska', 'video/x-m4v', 'video/avi', 'video/x-msvideo',
])
const ALLOWED_EXT = new Set(['mp4', 'webm', 'mov', 'mkv', 'm4v', 'avi'])
const MAX_FILENAME_LEN = 200

export async function POST(req: NextRequest) {
  const { guard } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { courseId, fileName, contentType } = body as {
    courseId: string
    fileName: string
    contentType: string
  }

  if (!courseId || !fileName) {
    return NextResponse.json({ error: 'courseId와 fileName이 필요합니다.' }, { status: 400 })
  }
  if (fileName.length > MAX_FILENAME_LEN) {
    return NextResponse.json({ error: `파일명이 너무 깁니다 (최대 ${MAX_FILENAME_LEN}자).` }, { status: 400 })
  }
  // MIME 검증 — 빈 값도 차단
  if (!contentType || !ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({
      error: `허용되지 않는 비디오 형식입니다. 허용: ${[...ALLOWED_MIME].join(', ')}`
    }, { status: 400 })
  }
  // 확장자 검증
  const ext = (fileName.split('.').pop() ?? '').toLowerCase()
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({
      error: `허용되지 않는 파일 확장자입니다. 허용: ${[...ALLOWED_EXT].join(', ')}`
    }, { status: 400 })
  }
  // courseId UUID 형식 가드 (Storage path 주입 방지)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseId)) {
    return NextResponse.json({ error: '유효하지 않은 courseId 형식.' }, { status: 400 })
  }

  // 파일명 정제 및 Storage 경로 생성
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
