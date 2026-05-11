'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'

const LEVEL_LABEL: Record<string, string> = {
  beginner: '입문',
  intermediate: '중급',
  advanced: '고급',
}

const PRICE_LABEL: Record<string, string> = {
  free: '무료만',
  paid: '유료만',
}

const RATING_LABEL: Record<string, string> = {
  '4.5': '4.5★ 이상',
  '4': '4.0★ 이상',
  '3.5': '3.5★ 이상',
}

const DURATION_LABEL: Record<string, string> = {
  under1h: '1시간 미만',
  '1to3h': '1~3시간',
  '3to10h': '3~10시간',
  over10h: '10시간 이상',
}

interface Chip {
  label: string
  onRemove: () => void
}

/**
 * /courses 의 상세 필터 (난이도/가격/평점/시간) 활성 항목을 칩으로 표시.
 * 활성 필터가 없으면 null 반환 — UI 자리 차지 X.
 */
export function ActiveFilterChips() {
  const router = useRouter()
  const sp = useSearchParams()

  const setParam = (mutate: (p: URLSearchParams) => void) => {
    const params = new URLSearchParams(sp.toString())
    mutate(params)
    params.delete('page')
    router.push(`/courses?${params.toString()}`)
  }

  const chips: Chip[] = []

  // 난이도 (다중)
  const levels = (sp.get('level') ?? '').split(',').filter(Boolean)
  for (const lv of levels) {
    chips.push({
      label: LEVEL_LABEL[lv] ?? lv,
      onRemove: () => {
        const next = levels.filter((x) => x !== lv).join(',')
        setParam((p) => {
          if (next) p.set('level', next)
          else p.delete('level')
        })
      },
    })
  }

  // 가격
  const price = sp.get('price') ?? ''
  if (price && PRICE_LABEL[price]) {
    chips.push({
      label: PRICE_LABEL[price],
      onRemove: () => setParam((p) => p.delete('price')),
    })
  }

  // 평점
  const rating = sp.get('rating_gte') ?? ''
  if (rating && RATING_LABEL[rating]) {
    chips.push({
      label: RATING_LABEL[rating],
      onRemove: () => setParam((p) => p.delete('rating_gte')),
    })
  }

  // 학습 시간
  const duration = sp.get('duration') ?? ''
  if (duration && DURATION_LABEL[duration]) {
    chips.push({
      label: DURATION_LABEL[duration],
      onRemove: () => setParam((p) => p.delete('duration')),
    })
  }

  if (chips.length === 0) return null

  function resetAll() {
    setParam((p) => {
      p.delete('level')
      p.delete('price')
      p.delete('rating_gte')
      p.delete('duration')
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((chip, i) => (
        <button
          key={i}
          type="button"
          onClick={chip.onRemove}
          className="group inline-flex items-center gap-1 rounded-full border border-accent/30 bg-accent-pale px-3 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white transition"
          aria-label={`${chip.label} 필터 제거`}
        >
          {chip.label}
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
      <button
        type="button"
        onClick={resetAll}
        className="text-xs text-gray-500 underline-offset-2 hover:text-accent hover:underline"
      >
        전체 초기화
      </button>
    </div>
  )
}
