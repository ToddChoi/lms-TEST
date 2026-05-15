import Link from 'next/link'
import { CheckCircle2, Mail, Clock } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '결제 완료 — 오프라인 교육' }

export default function ApplySuccessPage({
  params,
}: {
  params: { slug: string; sessionId: string }
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-9 w-9 text-green-600" />
        </div>
        <h1 className="text-2xl font-bold text-navy">결제 완료</h1>
        <p className="mt-2 text-sm text-gray-600">
          신청이 정상적으로 접수되었습니다.
        </p>

        <div className="mt-6 flex flex-col gap-3 rounded-xl bg-silver p-5 text-left text-sm text-gray-700">
          <div className="flex items-start gap-2">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              결제 정보 처리는 보통 <strong>10초 이내</strong> 완료됩니다. 마이페이지에서 자리 확정 상태를 확인해주세요.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>
              자리 확정 안내 이메일이 잠시 후 발송됩니다. 받은편지함을 확인해주세요.
            </span>
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href="/my"
            className="inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-light"
          >
            마이페이지로 이동
          </Link>
          <Link
            href={`/offline/${params.slug}`}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm text-gray-600 hover:bg-silver"
          >
            프로그램 상세로
          </Link>
        </div>
      </div>
    </div>
  )
}
