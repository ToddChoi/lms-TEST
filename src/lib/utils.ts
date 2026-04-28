import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import 'dayjs/locale/ko'

dayjs.extend(relativeTime)
dayjs.locale('ko')

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** 초를 "X시간 Y분" 형식으로 변환 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}초`
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours === 0) return `${minutes}분`
  if (minutes === 0) return `${hours}시간`
  return `${hours}시간 ${minutes}분`
}

/** 날짜를 "YYYY년 MM월 DD일" 형식으로 변환 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY년 MM월 DD일')
}

/** 날짜를 "YYYY-MM-DD" 형식으로 변환 */
export function formatDateShort(date: string | Date | null | undefined): string {
  if (!date) return '-'
  return dayjs(date).format('YYYY-MM-DD')
}

/** 상대 시간 (예: "3일 전") */
export function formatRelative(date: string | Date): string {
  return dayjs(date).fromNow()
}

/** 원화 형식으로 변환 */
export function formatPrice(price: number): string {
  if (price === 0) return '무료'
  return price.toLocaleString('ko-KR') + '원'
}

/** 수강 신청 가능 여부 확인 */
export function isEnrollable(enrollStart: string | null, enrollEnd: string | null): boolean {
  const now = dayjs()
  if (enrollStart && dayjs(enrollStart).isAfter(now)) return false
  if (enrollEnd && dayjs(enrollEnd).isBefore(now)) return false
  return true
}

/** 수료증 번호 생성 (CERT-YYYYMMDD-XXXXXX) */
export function generateCertNumber(): string {
  const date = dayjs().format('YYYYMMDD')
  const random = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `CERT-${date}-${random}`
}

/** 슬러그 생성 (한글 제목 → URL-safe) */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}
