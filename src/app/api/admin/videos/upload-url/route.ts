import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdmin } from '@supabase/supabase-js'

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
  // ── 1. 로그인 및 관리자 권한 확인 ────────────────────────────
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
  }

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

  // ── 5. Public URL도 함께 반환 ────────────────────────────────
  const { data: urlData } = (admin as any).storage
    .from('course-videos')
    .getPublicUrl(path)

  return NextResponse.json({
    signedUrl: data.signedUrl,
    publicUrl: urlData.publicUrl,
    path,
  })
}
