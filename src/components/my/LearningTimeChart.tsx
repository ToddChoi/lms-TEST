import { TrendingUp } from 'lucide-react'

interface Props {
  /** 길이 30, 각 항목은 해당 일의 학습 시간(초). 0번이 30일 전, 29번이 오늘 */
  daily: number[]
}

function formatHm(seconds: number): string {
  if (seconds < 60) return `${seconds}초`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}분`
  const h = Math.floor(m / 60)
  const mm = m % 60
  return mm > 0 ? `${h}시간 ${mm}분` : `${h}시간`
}

export function LearningTimeChart({ daily }: Props) {
  const total = daily.reduce((s, v) => s + v, 0)
  const max = Math.max(1, ...daily)
  const days7 = daily.slice(-7).reduce((s, v) => s + v, 0)

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <TrendingUp className="h-4 w-4 text-accent" /> 최근 30일 학습 시간
        </h3>
        <div className="text-right">
          <p className="text-base font-bold text-navy leading-none">{formatHm(total)}</p>
          <p className="mt-0.5 text-[10px] text-gray-400">최근 7일 {formatHm(days7)}</p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-0.5 h-24">
        {daily.map((s, i) => {
          const h = (s / max) * 100
          return (
            <div
              key={i}
              className="flex-1 rounded-t bg-accent/20 transition-colors hover:bg-accent"
              style={{ height: `${Math.max(2, h)}%` }}
              title={`${s}초`}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>30일 전</span>
        <span>오늘</span>
      </div>
    </div>
  )
}
