'use client'

import { useEffect, useState } from 'react'
import { Star, Trash2, BadgeCheck, Loader2 } from 'lucide-react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

interface Review {
  id: string
  user_id: string
  rating: number
  content: string
  is_verified: boolean
  helpful_count: number
  created_at: string
  profiles: { name: string | null; avatar_url: string | null } | null
}

interface Props {
  courseId: string
  currentUserId?: string | null
  isEnrolled: boolean
}

export function CourseReviewSection({ courseId, currentUserId, isEnrolled }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [rating, setRating] = useState(5)
  const [content, setContent] = useState('')
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState('')
  const confirm = useConfirm()

  useEffect(() => {
    let alive = true
    setLoading(true)
    fetch(`/api/reviews?courseId=${encodeURIComponent(courseId)}`)
      .then((r) => r.json())
      .then((d) => { if (alive) setReviews(d.data ?? []) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [courseId])

  const myReview = currentUserId
    ? reviews.find((r) => r.user_id === currentUserId)
    : null

  // 평점 분포 (5~1)
  const total = reviews.length
  const dist = [5, 4, 3, 2, 1].map((star) => {
    const count = reviews.filter((r) => r.rating === star).length
    return { star, count, pct: total > 0 ? (count / total) * 100 : 0 }
  })
  const avg = total > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / total
    : 0

  async function handleSubmit() {
    if (!content.trim()) { setError('내용을 입력하세요.'); return }
    setPosting(true); setError('')
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, rating, content }),
      })
      const d = await res.json()
      if (!res.ok) {
        setError(d.error ?? '저장 실패')
      } else {
        setReviews((prev) => [d.data, ...prev])
        setContent('')
        setRating(5)
        setShowForm(false)
      }
    } finally {
      setPosting(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: '후기 삭제',
      message: '이 후기를 삭제하시겠습니까?',
      variant: 'danger',
      confirmLabel: '삭제',
    })
    if (!ok) return
    const res = await fetch('/api/reviews', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (res.ok) setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-navy">수강평</h2>

      {/* 평점 요약 */}
      <div className="mb-6 grid grid-cols-1 gap-4 rounded-xl bg-silver/50 p-5 sm:grid-cols-[180px_1fr]">
        <div className="flex flex-col items-center justify-center">
          <span className="text-4xl font-bold text-navy">{avg.toFixed(1)}</span>
          <RatingStars rating={Math.round(avg)} size={4} />
          <span className="mt-1 text-xs text-gray-500">총 {total.toLocaleString()}개</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {dist.map((d) => (
            <div key={d.star} className="flex items-center gap-2 text-xs">
              <span className="w-6 text-gray-500">{d.star}점</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                <div className="h-full bg-amber-400" style={{ width: `${d.pct}%` }} />
              </div>
              <span className="w-10 text-right text-gray-500">{d.count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 작성 폼 */}
      {currentUserId && isEnrolled && !myReview && (
        <div className="mb-5">
          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="rounded-lg border border-accent bg-accent-pale px-4 py-2 text-sm font-medium text-accent hover:bg-accent hover:text-white transition"
            >
              + 후기 작성하기
            </button>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm text-gray-600">평점:</span>
                <RatingPicker value={rating} onChange={setRating} />
              </div>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={4}
                placeholder="강좌에 대한 솔직한 후기를 남겨주세요."
                className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
              />
              {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => { setShowForm(false); setError('') }}
                  className="rounded-lg border border-gray-200 px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={posting}
                  className="rounded-lg bg-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-accent-light disabled:opacity-50"
                >
                  {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : '등록'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {currentUserId && !isEnrolled && (
        <p className="mb-5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          수강 신청 후 후기를 작성할 수 있습니다.
        </p>
      )}

      {/* 후기 목록 */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-400">아직 후기가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-sm font-semibold text-navy">
                  {r.profiles?.name ?? '익명'}
                </span>
                {r.is_verified && (
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    <BadgeCheck className="h-3 w-3" /> 실수강생
                  </span>
                )}
                <RatingStars rating={r.rating} size={3.5} />
                <span className="ml-auto flex items-center gap-1 text-[11px] text-gray-400">
                  {new Date(r.created_at).toLocaleDateString()}
                  {currentUserId === r.user_id && (
                    <button
                      onClick={() => handleDelete(r.id)}
                      aria-label="삭제"
                      className="ml-1 text-gray-300 hover:text-red-500"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              </div>
              <p className="whitespace-pre-line text-sm text-gray-700 leading-relaxed">
                {r.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function RatingStars({ rating, size = 4 }: { rating: number; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            's-' + size,
            s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'
          )}
          style={{ width: `${size * 4}px`, height: `${size * 4}px` }}
        />
      ))}
    </div>
  )
}

function RatingPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onChange(s)}
          aria-label={`${s}점`}
          className="p-0.5"
        >
          <Star
            className={cn(
              'h-5 w-5 transition',
              s <= value ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            )}
          />
        </button>
      ))}
      <span className="ml-1 text-sm font-medium text-navy">{value}점</span>
    </div>
  )
}
