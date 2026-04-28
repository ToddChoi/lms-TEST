import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CertificateView } from '@/components/learn/CertificateView'
import type { Metadata } from 'next'

interface Props { params: { id: string } }

export const metadata: Metadata = { title: '수료증 보기' }

export default async function CertificateDetailPage({ params }: Props) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawCert } = await supabase
    .from('certificates')
    .select(`id, cert_number, issued_at, pdf_url,
      courses (id, title),
      profiles (name)
    `)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  type CertDetail = {
    id: string; cert_number: string; issued_at: string; pdf_url: string | null
    courses: { id: string; title: string } | null
    profiles: { name: string } | null
  }
  const cert = rawCert as unknown as CertDetail | null
  if (!cert) notFound()

  return (
    <CertificateView
      certNumber={cert.cert_number}
      issuedAt={cert.issued_at}
      courseName={cert.courses?.title ?? ''}
      recipientName={cert.profiles?.name ?? ''}
      certId={cert.id}
      pdfUrl={cert.pdf_url}
    />
  )
}
