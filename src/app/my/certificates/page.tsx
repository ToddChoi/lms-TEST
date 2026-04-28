import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Award, Download, ExternalLink } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '수료증' }

export default async function CertificatesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawCerts } = await supabase
    .from('certificates')
    .select(`id, cert_number, issued_at, pdf_url, courses (id, title, thumbnail_url)`)
    .eq('user_id', user.id)
    .order('issued_at', { ascending: false })

  type CertRow = {
    id: string; cert_number: string; issued_at: string; pdf_url: string | null
    courses: { id: string; title: string; thumbnail_url: string | null } | null
  }
  const certs = rawCerts as unknown as CertRow[] | null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">수료증</h1>
        <p className="mt-1 text-sm text-gray-500">
          수료한 강좌의 수료증을 확인하고 다운로드하세요
        </p>
      </div>

      {certs && certs.length > 0 ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {certs.map((cert) => (
            <div key={cert.id} className="rounded-2xl bg-white p-5 shadow-sm">
              {/* 수료증 미리보기 헤더 */}
              <div className="flex items-center justify-center rounded-xl bg-gradient-to-br from-navy to-navy-mid py-8">
                <div className="text-center text-white">
                  <Award className="mx-auto h-10 w-10 text-yellow-300" />
                  <p className="mt-2 text-xs opacity-60">수료증</p>
                  <p className="mt-0.5 text-sm font-bold">CERTIFICATE</p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="font-semibold text-navy line-clamp-2">
                  {cert.courses?.title ?? '(강좌 정보 없음)'}
                </h3>
                <p className="mt-1 text-xs text-gray-400">
                  발급일: {formatDate(cert.issued_at)}
                </p>
                <p className="mt-0.5 font-mono text-xs text-gray-400">
                  {cert.cert_number}
                </p>
              </div>

              <div className="mt-4 flex gap-2">
                <Link
                  href={`/my/certificates/${cert.id}`}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-gray-200 py-2 text-sm font-medium text-gray-700 hover:border-accent hover:text-accent"
                >
                  <ExternalLink className="h-4 w-4" /> 보기
                </Link>
                {cert.pdf_url ? (
                  <a
                    href={cert.pdf_url}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-sm font-medium text-white hover:bg-accent-light"
                  >
                    <Download className="h-4 w-4" /> PDF
                  </a>
                ) : (
                  <a
                    href={`/api/certificates/generate?id=${cert.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-accent py-2 text-sm font-medium text-white hover:bg-accent-light"
                  >
                    <Download className="h-4 w-4" /> PDF
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl bg-white py-20 text-center shadow-sm">
          <Award className="h-12 w-12 text-gray-200" />
          <p className="mt-4 font-medium text-gray-400">아직 수료한 강좌가 없습니다</p>
          <p className="mt-1 text-sm text-gray-300">
            강좌의 80% 이상을 완료하면 수료증이 자동 발급됩니다
          </p>
          <Link
            href="/courses"
            className="mt-5 rounded-xl bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-light"
          >
            강좌 둘러보기
          </Link>
        </div>
      )}
    </div>
  )
}
