import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatDuration, formatCertDate, type CertData } from '@/lib/cert-render'
import type { CertificateTemplate } from '@/types/database'

export const dynamic = 'force-dynamic'

/**
 * GET /api/certificates/generate?id=<certId>
 * 수료증 PDF 생성 — 템플릿 + dynamic data 결합.
 *
 * Phase 6 — 이전 hardcoded PDF → 템플릿 driven.
 *  - certificates.template_id 가 있으면 그걸, 없으면 is_default=true 글로벌 템플릿
 *  - 학습 이력 (수강 신청일, 강좌 총 시간, 수료일, 강사명) 자동 추출
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const certId = searchParams.get('id')
  if (!certId) return NextResponse.json({ error: 'id 파라미터가 필요합니다.' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  // 1) 수료증 + 강좌 + 수료자
  const { data: rawCert } = await supabase
    .from('certificates')
    .select(`
      id, cert_number, issued_at, template_id, course_id,
      courses (id, title, total_duration, instructor_name),
      profiles (name)
    `)
    .eq('id', certId)
    .eq('user_id', user.id)
    .single()

  type CertRow = {
    id: string; cert_number: string; issued_at: string
    template_id: string | null; course_id: string
    courses: { id: string; title: string; total_duration: number | null; instructor_name: string | null } | null
    profiles: { name: string } | null
  }
  const cert = rawCert as unknown as CertRow | null
  if (!cert) return NextResponse.json({ error: '수료증을 찾을 수 없습니다.' }, { status: 404 })

  // 2) 신청일 — enrollments
  const { data: rawEnroll } = await supabase
    .from('enrollments')
    .select('enrolled_at')
    .eq('user_id', user.id)
    .eq('course_id', cert.course_id)
    .maybeSingle()
  const enrolledAt = (rawEnroll as unknown as { enrolled_at: string } | null)?.enrolled_at ?? null

  // 3) 템플릿 — 명시 / default
  let templateRow: CertificateTemplate | null = null
  if (cert.template_id) {
    const { data } = await supabase
      .from('certificate_templates').select('*').eq('id', cert.template_id).maybeSingle()
    templateRow = (data as unknown as CertificateTemplate | null) ?? null
  }
  if (!templateRow) {
    const { data } = await supabase
      .from('certificate_templates').select('*')
      .eq('is_default', true).eq('scope_type', 'global')
      .limit(1).maybeSingle()
    templateRow = (data as unknown as CertificateTemplate | null) ?? null
  }
  if (!templateRow) {
    return NextResponse.json({
      error: '수료증 템플릿이 없습니다. supabase/migration_phase6_certificate_templates.sql 실행 필요.',
    }, { status: 500 })
  }

  // 4) dynamic data
  const data: CertData = {
    recipient_name: cert.profiles?.name ?? '',
    course_title: cert.courses?.title ?? '',
    course_duration: formatDuration(cert.courses?.total_duration ?? 0),
    enrolled_at: formatCertDate(enrolledAt),
    completed_at: formatCertDate(cert.issued_at),
    cert_number: cert.cert_number,
    instructor_name: cert.courses?.instructor_name ?? '',
  }

  // 5) PDF
  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { CertificatePDF } = await import('@/components/learn/CertificatePDF')
    const { createElement } = await import('react')

    const element = createElement(CertificatePDF as any, {
      template: {
        page_size: templateRow.page_size,
        page_orientation: templateRow.page_orientation,
        background_color: templateRow.background_color,
        background_url: templateRow.background_url,
        elements: templateRow.elements,
      },
      data,
    }) as any

    const pdfBuffer = await renderToBuffer(element)
    const uint8 = new Uint8Array(pdfBuffer)

    return new Response(uint8, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="certificate-${cert.cert_number}.pdf"`,
        'Content-Length': String(uint8.byteLength),
      },
    })
  } catch (err: any) {
    console.error('PDF 생성 오류:', err)
    return NextResponse.json({ error: 'PDF 생성에 실패했습니다.' }, { status: 500 })
  }
}
