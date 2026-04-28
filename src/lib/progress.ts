/**
 * 강의 진도 저장 공통 라이브러리.
 *
 * - 5초 throttle: 자주 호출돼도 5초에 한 번만 실제 API 로 보냅니다.
 * - 90% 시청 도달 시 자동 완료 처리.
 * - isCompleted=true 인 호출은 throttle 무시하고 즉시 발송.
 * - 응답에 courseCompleted 가 포함되면 onCourseCompleted 콜백 실행 (선택).
 */

const THROTTLE_MS = 5000

export interface SaveProgressInput {
  lessonId: string
  courseId: string
  watchedSeconds: number
  duration?: number
  isCompleted?: boolean
}

export interface SaveProgressResult {
  ok: boolean
  courseCompleted?: boolean
  error?: string
}

/** 마지막으로 발송한 시각을 lessonId 별로 기억 */
const lastSentAt = new Map<string, number>()

export async function saveProgress(input: SaveProgressInput): Promise<SaveProgressResult> {
  const { lessonId, courseId, watchedSeconds, duration, isCompleted: explicit } = input

  // 90% 이상 시청 시 자동 완료 처리
  let isCompleted = !!explicit
  if (!isCompleted && duration && duration > 0 && watchedSeconds / duration >= 0.9) {
    isCompleted = true
  }

  // throttle: 완료가 아닐 때만 적용
  const now = Date.now()
  if (!isCompleted) {
    const last = lastSentAt.get(lessonId) ?? 0
    if (now - last < THROTTLE_MS) return { ok: true }
  }
  lastSentAt.set(lessonId, now)

  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lessonId,
        courseId,
        watchedSeconds: Math.max(0, Math.floor(watchedSeconds)),
        isCompleted,
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: data.error ?? `HTTP ${res.status}` }
    }
    const data = await res.json().catch(() => ({}))
    return { ok: true, courseCompleted: !!data.courseCompleted }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' }
  }
}

/** 강의 전환 시 throttle 캐시 정리 */
export function resetProgressThrottle(lessonId?: string) {
  if (lessonId) lastSentAt.delete(lessonId)
  else lastSentAt.clear()
}
