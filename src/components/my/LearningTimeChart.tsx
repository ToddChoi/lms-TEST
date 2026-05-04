import { TrendingUp } from 'lucide-react'

interface Props {
  /** 길이 30, 각 항목은 해당 일에 학습 활동(시청)이 있었던 강의 수 (0이면 학습 안 함) */
  daily: number[]
}

/**
 * 최근 30일 학습 활동 차트.
 *
 * 정확한 일별 시청 시간을 알려면 별도 활동 로그(activity log)가 필요한데,
 * 현재 lesson_progress.watched_seconds 는 lesson 별 누적값이라 "그날 시청한 시간"을
 * 정확히 분리하기 어려움. 그래서 "그날 학습 활동이 있었던 강의 수" 라는
 * 단순하지만 정직한 지표를 보여줌.
 */
export function LearningTimeChart({ daily }: Props) {
  const totalSessions = daily.reduce((s, v) => s + v, 0)
  const max = Math.max(1, ...daily)
  const days7 = daily.slice(-7).reduce((s, v) => s + v, 0)
  const activeDays = daily.filter((v) => v > 0).length

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <TrendingUp className="h-4 w-4 text-accent" /> 최근 30일 학습 활동
        </h3>
        <div className="text-right">
          <p className="text-base font-bold text-navy leading-none">{activeDays}일</p>
          <p className="mt-0.5 text-[10px] text-gray-400">최근 7일 {days7}회 시청</p>
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
              title={s > 0 ? `${s}개 강의 학습` : '학습 안 함'}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-gray-400">
        <span>30일 전</span>
        <span>총 {totalSessions}회 시청</span>
        <span>오늘</span>
      </div>
    </div>
  )
}
