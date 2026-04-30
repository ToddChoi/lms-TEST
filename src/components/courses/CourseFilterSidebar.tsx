'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  className?: string
}

const LEVELS = [
  { value: 'beginner',     label: '입문' },
  { value: 'intermediate', label: '중급' },
  { value: 'advanced',     label: '고급' },
]

const PRICE_OPTIONS = [
  { value: '',     label: '전체' },
  { value: 'free', label: '무료만' },
  { value: 'paid', label: '유료만' },
]

const RATING_OPTIONS = [
  { value: '',  label: '전체' },
  { value: '4.5', label: '4.5점 이상' },
  { value: '4',   label: '4.0점 이상' },
  { value: '3.5', label: '3.5점 이상' },
]

const DURATION_OPTIONS = [
  { value: '',         label: '전체' },
  { value: 'under1h',  label: '1시간 미만' },
  { value: '1to3h',    label: '1~3시간' },
  { value: '3to10h',   label: '3~10시간' },
  { value: 'over10h',  label: '10시간 이상' },
]

/** /courses 페이지 좌측 상세 필터 사이드바 (데스크탑 전용) */
export function CourseFilterSidebar({ className = '' }: Props) {
  const router = useRouter()
  const sp = useSearchParams()

  const set = (key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    params.delete('page')
    router.push(`/courses?${params.toString()}`)
  }

  const toggleLevel = (lv: string) => {
    const cur = (sp.get('level') ?? '').split(',').filter(Boolean)
    const next = cur.includes(lv) ? cur.filter((x) => x !== lv) : [...cur, lv]
    set('level', next.join(','))
  }

  const currentLevels = (sp.get('level') ?? '').split(',').filter(Boolean)
  const currentPrice = sp.get('price') ?? ''
  const currentRating = sp.get('rating_gte') ?? ''
  const currentDuration = sp.get('duration') ?? ''

  const hasAny =
    currentLevels.length > 0 || !!currentPrice || !!currentRating || !!currentDuration

  function reset() {
    const params = new URLSearchParams(sp.toString())
    params.delete('level')
    params.delete('price')
    params.delete('rating_gte')
    params.delete('duration')
    params.delete('page')
    router.push(`/courses?${params.toString()}`)
  }

  return (
    <aside className={cn('rounded-2xl bg-white p-5 shadow-sm', className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-bold text-navy">상세 필터</h3>
        {hasAny && (
          <button
            onClick={reset}
            className="text-xs text-gray-500 hover:text-accent"
          >
            초기화
          </button>
        )}
      </div>

      {/* 난이도 */}
      <Group title="난이도">
        <div className="flex flex-wrap gap-1.5">
          {LEVELS.map((lv) => {
            const on = currentLevels.includes(lv.value)
            return (
              <button
                key={lv.value}
                onClick={() => toggleLevel(lv.value)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition',
                  on
                    ? 'border-accent bg-accent text-white'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-accent hover:text-accent'
                )}
              >
                {lv.label}
              </button>
            )
          })}
        </div>
      </Group>

      {/* 가격 */}
      <Group title="가격">
        <RadioRow
          name="price"
          options={PRICE_OPTIONS}
          value={currentPrice}
          onChange={(v) => set('price', v)}
        />
      </Group>

      {/* 평점 */}
      <Group title="평점">
        {RATING_OPTIONS.map((opt) => {
          const on = currentRating === opt.value
          return (
            <button
              key={opt.value || 'all'}
              onClick={() => set('rating_gte', opt.value)}
              className={cn(
                'flex w-full items-center gap-1 rounded-md px-2 py-1 text-xs transition',
                on ? 'bg-accent-pale text-accent font-semibold' : 'text-gray-600 hover:bg-silver'
              )}
            >
              {opt.value && (
                <span className="inline-flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </span>
              )}
              {opt.label}
            </button>
          )
        })}
      </Group>

      {/* 학습 시간 */}
      <Group title="학습 시간" last>
        <RadioRow
          name="duration"
          options={DURATION_OPTIONS}
          value={currentDuration}
          onChange={(v) => set('duration', v)}
        />
      </Group>
    </aside>
  )
}

function Group({
  title, children, last,
}: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={cn('py-3', !last && 'border-b border-gray-100')}>
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
        {title}
      </p>
      {children}
    </div>
  )
}

function RadioRow({
  name, options, value, onChange,
}: {
  name: string
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-0.5">
      {options.map((opt) => {
        const on = value === opt.value
        return (
          <label
            key={`${name}-${opt.value || 'all'}`}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-xs transition',
              on ? 'bg-accent-pale text-accent font-semibold' : 'text-gray-600 hover:bg-silver'
            )}
          >
            <input
              type="radio"
              name={name}
              checked={on}
              onChange={() => onChange(opt.value)}
              className="h-3 w-3 accent-accent"
            />
            {opt.label}
          </label>
        )
      })}
    </div>
  )
}
