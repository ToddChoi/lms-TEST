import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AlertCircle, QrCode } from 'lucide-react'
import { CheckInClient } from '@/components/offline/CheckInClient'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'QR 출석 체크' }
export const dynamic = 'force-dynamic'

export default async function CheckInPage({
  searchParams,
}: {
  searchParams: { token?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const token = searchParams.token?.trim()

  if (!user) {
    const url = `/offline/check-in${token ? `?token=${encodeURIComponent(token)}` : ''}`
    redirect(`/login?redirectTo=${encodeURIComponent(url)}`)
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
            <AlertCircle className="h-9 w-9 text-amber-600" />
          </div>
          <h1 className="text-xl font-bold text-navy">QR 코드를 다시 스캔해주세요</h1>
          <p className="mt-2 text-sm text-gray-600">
            URL 에 token 파라미터가 없습니다. 강좌 현장의 QR 코드를 스캔해주세요.
          </p>
          <Link
            href="/my/offline"
            className="mt-6 inline-flex items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-light"
          >
            마이페이지로
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent-pale">
          <QrCode className="h-9 w-9 text-accent" />
        </div>
        <h1 className="text-xl font-bold text-navy">출석 체크 중...</h1>
        <p className="mt-2 text-sm text-gray-600">
          잠시만 기다려주세요.
        </p>
        <CheckInClient token={token} />
      </div>
    </div>
  )
}
