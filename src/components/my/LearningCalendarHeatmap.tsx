import { CalendarDays } from 'lucide-react'

interface Props {
  /**
   * 길이 84(12주). 각 항목은 해당 날짜에 학습 활동 횟수 (0이면 학습 안 함).
   * index 0 = 84일 전, index 83 = 오늘.
   */
  daily: number[]
}

const WEEK_LABELS = ['', '월', '', '수', '', '금', '']
const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

/**
 * GitHub 스타일 학습 활동 히트맵 (12주 = 84일).
 *
 * 데이터 출처: lesson_progress.last_watched_at 의 그날 갱신된 강의 수.
 * 정확한 시청 시간 측정은 별도 활동 로그가 필요해서 단순화함.
 *
 * 색상 4단계: 0 (없음) / 1 / 2 / 3+ (활발)
 */
export function LearningCalendarHeatmap({ daily }: Props) {
  if (daily.length !== 84) {
    // 안전 가드 — 길이 안 맞으면 그래도 렌더링은 시도
    daily = [...daily, ...new Array(Math.max(0, 84 - daily.length)).fill(0)].slice(-84)
  }

  // 12주 × 7일 그리드 — 컬럼 단위
  const weeks: { date: Date; count: number }[][] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - 83)

  let cursor = 0
  for (let w = 0; w < 12; w++) {
    const week: { date: Date; count: number }[] = []
    for (let d = 0; d < 7; d++) {
      const dt = new Date(startDate)
      dt.setDate(startDate.getDate() + cursor)
      week.push({ date: dt, count: daily[cursor] ?? 0 })
      cursor++
    }
    weeks.push(week)
  }

  // 월 라벨 위치 (각 주의 첫 날짜의 월이 바뀌면 라벨 표시)
  const monthLabels: { weekIdx: number; label: string }[] = []
  let prevMonth = -1
  weeks.forEach((week, i) => {
    const m = week[0].date.getMonth()
    if (m !== prevMonth) {
      monthLabels.push({ weekIdx: i, label: MONTH_NAMES[m] })
      prevMonth = m
    }
  })

  const totalDays = daily.filter((c) => c > 0).length
  const totalSessions = daily.reduce((s, v) => s + v, 0)

  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-navy">
          <CalendarDays className="h-4 w-4 text-accent" /> 학습 캘린더
        </h3>
        <p className="text-xs text-gray-500">
          최근 12주 · <span className="font-semibold text-navy">{totalDays}일</span> 학습 (총 {totalSessions}회)
        </p>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-flex flex-col gap-1">
          {/* 월 라벨 행 */}
          <div className="flex gap-[3px] pl-6 text-[10px] text-gray-400 h-3">
            {weeks.map((_, i) => {
              const lbl = monthLabels.find((m) => m.weekIdx === i)
              return (
                <div key={i} className="w-[14px] text-left">
                  {lbl ? lbl.label : ''}
                </div>
              )
            })}
          </div>

          {/* 요일 라벨 + 셀 그리드 */}
          <div className="flex gap-[3px]">
            <div className="flex flex-col justify-between gap-[3px] pr-1 text-[9px] text-gray-400">
              {WEEK_LABELS.map((d, i) => (
                <div key={i} className="h-[14px] leading-[14px] w-4 text-right">{d}</div>
              ))}
            </div>
            <div className="flex gap-[3px]">
              {weeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-[3px]">
                  {week.map((day, di) => (
                    <Cell key={di} count={day.count} date={day.date} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-gray-400">
        <span>적음</span>
        {[0, 1, 2, 3].map((c) => (
          <div key={c} className={`h-3 w-3 rounded-sm ${colorFor(c)}`} />
        ))}
        <span>많음</span>
      </div>
    </div>
  )
}

function Cell({ count, date }: { count: number; date: Date }) {
  const dateStr = `${date.getMonth() + 1}/${date.getDate()}`
  const title = count > 0 ? `${dateStr}: ${count}회 학습` : `${dateStr}: 학습 없음`
  return (
    <div
      className={`h-[14px] w-[14px] rounded-sm ${colorFor(count)} transition`}
      title={title}
      aria-label={title}
    />
  )
}

function colorFor(count: number): string {
  if (count === 0) return 'bg-gray-100'
  if (count === 1) return 'bg-accent/30'
  if (count === 2) return 'bg-accent/60'
  return 'bg-accent'
}
