'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BookOpen, ArrowLeft, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })

    setLoading(false)
    if (err) {
      setError('이메일 발송에 실패했습니다. 다시 시도해주세요.')
    } else {
      setSent(true)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-silver px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-navy">Ingrow LMS</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-navy">비밀번호 찾기</h1>
          <p className="mt-1 text-sm text-gray-500">
            가입한 이메일로 재설정 링크를 보내드립니다
          </p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          {sent ? (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
              <div>
                <p className="font-semibold text-navy">이메일을 발송했습니다</p>
                <p className="mt-1 text-sm text-gray-500">
                  <span className="font-medium text-accent">{email}</span>으로
                  <br />비밀번호 재설정 링크를 보내드렸습니다.
                </p>
              </div>
              <p className="text-xs text-gray-400">
                메일이 오지 않으면 스팸함을 확인해주세요.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <Input
                label="가입한 이메일"
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Button type="submit" size="lg" loading={loading} className="mt-2 w-full">
                재설정 링크 보내기
              </Button>
            </form>
          )}

          <div className="mt-6 flex justify-center">
            <Link
              href="/login"
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> 로그인으로 돌아가기
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
