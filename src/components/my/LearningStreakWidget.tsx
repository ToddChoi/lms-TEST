import { Flame } from 'lucide-react'

interface Props {
  /** 오늘부터 거꾸로 연속된 학습일 (UTC 또는 로컬은 호출자에서 결정) */
  streak: number
  /** 최근 7일 중 학습한 날짜 (그날 학습했으면 true) */
  weekDots: boolean[]
}

const DAYS = ['일', '월', '화', '수', '목', '금', '토']

export function LearningStreakWidget({ streak, weekDots }: Props) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <Flame className="h-4 w-4 text-orange-500" /> 학습 streak
        </h3>
        <span className="text-xs text-gray-400">최근 7일</span>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <p className="text-3xl font-bold text-navy leading-none">{streak}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {streak > 0 ? `${streak}일 연속 학습 중` : '오늘 학습을 시작해보세요'}
          </p>
        </div>
        <div className="ml-auto flex gap-1">
          {weekDots.map((on, i) => {
            // i=0이 오늘로부터 6일 전, i=6이 오늘
            const dayLabel = DAYS[(new Date().getDay() + 7 - (6 - i)) % 7]
            return (
              <div key={i} className="flex flex-col items-center gap-0.5">
                <div
                  className={`h-7 w-7 rounded-md ${
                    on ? 'bg-orange-400' : 'bg-gray-100'
                  }`}
                  title={on ? '학습함' : '미학습'}
                />
                <span className="text-[9px] text-gray-400">{dayLabel}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
