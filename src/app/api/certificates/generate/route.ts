import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// GET /api/certificates/generate?id=<certId>
// 수료증 PDF를 생성해서 브라우저로 직접 스트리밍 (Storage 불필요)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const certId = searchParams.get('id')
  if (!certId) return NextResponse.json({ error: 'id 파라미터가 필요합니다.' }, { status: 400 })

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  // 수료증 조회
  const { data: rawCert } = await supabase
    .from('certificates')
    .select('id, cert_number, issued_at, courses (title), profiles (name)')
    .eq('id', certId)
    .eq('user_id', user.id)
    .single()

  type CertRow = {
    id: string; cert_number: string; issued_at: string
    courses: { title: string } | null
    profiles: { name: string } | null
  }
  const cert = rawCert as unknown as CertRow | null
  if (!cert) return NextResponse.json({ error: '수료증을 찾을 수 없습니다.' }, { status: 404 })

  try {
    const { renderToBuffer } = await import('@react-pdf/renderer')
    const { CertificatePDF } = await import('@/components/learn/CertificatePDF')
    const { createElement } = await import('react')

    const element = createElement(CertificatePDF as any, {
      certNumber: cert.cert_number,
      issuedAt: cert.issued_at,
      courseName: cert.courses?.title ?? '',
      recipientName: cert.profiles?.name ?? '',
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
