'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { BookOpen, CheckCircle, CreditCard, Lock } from 'lucide-react'

interface EnrollButtonProps {
  courseId: string
  isLoggedIn: boolean
  isEnrolled: boolean
  isEnrollable: boolean
  price: number
}

export function EnrollButton({
  courseId,
  isLoggedIn,
  isEnrolled,
  isEnrollable,
  price,
}: EnrollButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (isEnrolled) {
    return (
      <Button
        size="lg"
        className="w-full"
        onClick={() => router.push(`/my/courses/${courseId}/learn`)}
      >
        <BookOpen className="h-4 w-4" /> 학습하기
      </Button>
    )
  }

  if (!isEnrollable) {
    return (
      <Button size="lg" variant="outline" disabled className="w-full">
        <Lock className="h-4 w-4" /> 신청 마감
      </Button>
    )
  }

  const handlePaidCheckout = async () => {
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=/courses/${courseId}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ course_id: courseId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '결제를 시작할 수 없습니다.')
        setLoading(false)
        return
      }

      if (data.url) {
        window.location.href = data.url
        return
      }

      setError('결제 페이지로 이동할 수 없습니다.')
      setLoading(false)
    } catch {
      setError('네트워크 오류가 발생했습니다.')
      setLoading(false)
    }
  }

  const handleFreeEnroll = async () => {
    if (!isLoggedIn) {
      router.push(`/login?redirectTo=/courses/${courseId}`)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/enrollments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || '수강 신청에 실패했습니다.')
        return
      }

      router.push(`/my/courses/${courseId}/learn`)
      router.refresh()
    } catch {
      setError('네트워크 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const isPaid = price > 0
  const handleClick = isPaid ? handlePaidCheckout : handleFreeEnroll

  return (
    <div className="flex flex-col gap-2">
      <Button size="lg" loading={loading} onClick={handleClick} className="w-full">
        {isPaid ? (
          <>
            <CreditCard className="h-4 w-4" />
            {isLoggedIn
              ? `₩${price.toLocaleString()} 결제하기`
              : '로그인 후 결제하기'}
          </>
        ) : (
          <>
            <CheckCircle className="h-4 w-4" />
            {isLoggedIn ? '무료 수강 신청' : '로그인 후 수강 신청'}
          </>
        )}
      </Button>
      {error && <p className="text-center text-xs text-red-500">{error}</p>}
    </div>
  )
}
