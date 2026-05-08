/**
 * 수료증 데이터 모델 + dynamic field 치환.
 * 순수 함수 — server/client 양쪽 사용. 단위 테스트 가능.
 */

export interface CertData {
  recipient_name: string
  course_title: string
  course_duration: string         // 이미 포맷됨 (예: '8시간 30분')
  enrolled_at: string             // 이미 포맷됨 (예: '2026년 03월 15일')
  completed_at: string
  cert_number: string
  instructor_name: string
}

const PLACEHOLDERS: (keyof CertData)[] = [
  'recipient_name', 'course_title', 'course_duration',
  'enrolled_at', 'completed_at', 'cert_number', 'instructor_name',
]

/**
 * "수료자 {{recipient_name}}" → "수료자 홍길동"
 * 알 수 없는 키는 빈 문자열 (하드 fail 방지).
 */
export function substitute(content: string, data: Partial<CertData>): string {
  if (!content) return ''
  return content.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, key: string) => {
    if (PLACEHOLDERS.includes(key as keyof CertData)) {
      return String(data[key as keyof CertData] ?? '')
    }
    return ''   // 알 수 없는 키 — 노이즈 방지
  })
}

/** 분 단위 정수 → "8시간 30분" / "30분" */
export function formatDuration(totalSeconds: number | null | undefined): string {
  if (!totalSeconds || totalSeconds <= 0) return '—'
  const totalMinutes = Math.round(totalSeconds / 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h > 0 && m > 0) return `${h}시간 ${m}분`
  if (h > 0) return `${h}시간`
  return `${m}분`
}

/** ISO date → "2026년 03월 15일" */
export function formatCertDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, '0')}월 ${String(d.getDate()).padStart(2, '0')}일`
}
