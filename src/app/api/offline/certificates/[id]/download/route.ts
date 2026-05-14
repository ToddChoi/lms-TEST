import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 수료증 PDF 다운로드 — GET /api/offline/certificates/[id]/download
 *
 * 본인 수료증만 — RLS 정책 (offline_certificates self read) 안 + admin 도 가능.
 * Storage 'certificates' bucket 의 pdf_url (path) 로 short-lived signed URL 생성 → redirect.
 */
export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 본인 / 본인 enrollment 의 cert 인지 검증
  const { data: rawCert } = await admin
    .from('offline_certificates')
    .select(`
      id, user_id, attendee_id, enrollment_id, pdf_url, certificate_number,
      offline_enrollments ( applicant_user_id ),
      offline_attendees ( user_id )
    `)
    .eq('id', params.id)
    .maybeSingle()
  const cert = rawCert as unknown as {
    id: string
    user_id: string | null
    attendee_id: string | null
    enrollment_id: string
    pdf_url: string | null
    certificate_number: string
    offline_enrollments: { applicant_user_id: string } | null
    offline_attendees: { user_id: string | null } | null
  } | null

  if (!cert) {
    return NextResponse.json({ error: '수료증을 찾을 수 없습니다.' }, { status: 404 })
  }

  // admin 또는 본인 / enrollment 소유자 / attendee user_id 매칭
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (rawProfile as unknown as { role: string } | null)?.role
  const isAdmin = role === 'admin' || role === 'superadmin'

  const isOwner =
    cert.user_id === user.id ||
    cert.attendee_id && cert.offline_attendees?.user_id === user.id ||
    cert.offline_enrollments?.applicant_user_id === user.id

  if (!isAdmin && !isOwner) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }

  if (!cert.pdf_url) {
    return NextResponse.json({ error: 'PDF 가 아직 생성되지 않았습니다.' }, { status: 404 })
  }

  // Storage signed URL (10분)
  const { data: signed, error } = await (admin as any)
    .storage.from('certificates')
    .createSignedUrl(cert.pdf_url, 600)
  if (error || !signed) {
    return NextResponse.json({ error: error?.message ?? 'signed URL 생성 실패' }, { status: 500 })
  }

  return NextResponse.redirect(signed.signedUrl)
}
