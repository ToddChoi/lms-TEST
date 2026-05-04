'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Award, Download, Printer, ArrowLeft, CheckCircle, Linkedin } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'

interface CertificateViewProps {
  certNumber: string
  issuedAt: string
  courseName: string
  recipientName: string
  certId: string
  pdfUrl: string | null
}

/**
 * LinkedIn "Add to Profile" URL 생성.
 * https://www.linkedin.com/help/linkedin/answer/a567169 참고.
 */
function buildLinkedInUrl(params: {
  certName: string
  organizationName: string
  issuedAt: string
  certNumber: string
  certUrl: string
}): string {
  const issued = new Date(params.issuedAt)
  const u = new URL('https://www.linkedin.com/profile/add')
  u.searchParams.set('startTask', 'CERTIFICATION_NAME')
  u.searchParams.set('name', params.certName)
  u.searchParams.set('organizationName', params.organizationName)
  u.searchParams.set('issueYear', String(issued.getFullYear()))
  u.searchParams.set('issueMonth', String(issued.getMonth() + 1))
  u.searchParams.set('certUrl', params.certUrl)
  u.searchParams.set('certId', params.certNumber)
  return u.toString()
}

export function CertificateView({
  certNumber, issuedAt, courseName, recipientName, certId, pdfUrl,
}: CertificateViewProps) {
  const [generating, setGenerating] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(pdfUrl)

  const handleGeneratePdf = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ certId }),
      })
      const data = await res.json()
      if (data.pdfUrl) setGeneratedUrl(data.pdfUrl)
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="w-full max-w-2xl">
        <Link href="/my/certificates" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> 수료증 목록
        </Link>
      </div>

      {/* 수료증 카드 */}
      <div
        id="certificate-card"
        className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-xl print:shadow-none"
      >
        {/* 상단 헤더 */}
        <div className="bg-gradient-to-r from-navy to-navy-light px-10 py-8 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium tracking-widest opacity-70">INGROW LMS</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">수료증</h1>
              <p className="mt-0.5 text-sm opacity-60">Certificate of Completion</p>
            </div>
            <Award className="h-16 w-16 text-yellow-300 opacity-90" />
          </div>
        </div>

        {/* 본문 */}
        <div className="px-10 py-8">
          <p className="text-center text-sm text-gray-400">이 수료증은 다음 분이 과정을 성공적으로 이수하였음을 증명합니다</p>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">수료자</p>
            <p className="mt-1 text-3xl font-bold text-navy">{recipientName}</p>
          </div>

          <div className="mt-6 rounded-2xl bg-silver p-5 text-center">
            <p className="text-sm text-gray-400">이수 과정</p>
            <p className="mt-1 text-xl font-bold text-navy">{courseName}</p>
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-5">
            <div>
              <p className="text-xs text-gray-400">발급일</p>
              <p className="mt-0.5 font-semibold text-gray-700">{formatDate(issuedAt)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">수료증 번호</p>
              <p className="mt-0.5 font-mono text-sm text-gray-700">{certNumber}</p>
            </div>
          </div>

          {/* 검증 마크 */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-green-600">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Ingrow LMS에서 공식 발급된 수료증입니다</span>
          </div>
        </div>
      </div>

      {/* 액션 버튼 */}
      <div className="flex w-full max-w-2xl flex-col gap-3 print:hidden">
        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => window.print()}
          >
            <Printer className="h-4 w-4" /> 인쇄
          </Button>

          {generatedUrl ? (
            <a
              href={generatedUrl}
              download={`${certNumber}.pdf`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
            >
              <Download className="h-4 w-4" /> PDF 다운로드
            </a>
          ) : (
            <Button className="flex-1" loading={generating} onClick={handleGeneratePdf}>
              <Download className="h-4 w-4" /> PDF 생성
            </Button>
          )}
        </div>

        {/* LinkedIn 프로필에 추가 */}
        <a
          href={buildLinkedInUrl({
            certName: courseName,
            organizationName: 'Ingrow LMS',
            issuedAt,
            certNumber,
            certUrl: typeof window !== 'undefined'
              ? `${window.location.origin}/my/certificates/${certId}`
              : `/my/certificates/${certId}`,
          })}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#0A66C2] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#0654a3]"
        >
          <Linkedin className="h-4 w-4" /> LinkedIn 프로필에 추가
        </a>
      </div>
    </div>
  )
}
