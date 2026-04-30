/**
 * Resend 클라이언트 싱글톤.
 *
 * 두 환경변수가 모두 설정된 경우에만 메일 발송 활성화:
 *  - RESEND_API_KEY      (필수)
 *  - EMAIL_FROM_ADDRESS  (필수, 도메인 인증된 발신 주소)
 *
 * 둘 중 하나라도 비어있으면 null/false 반환 → 호출 측에서 skip 처리.
 *
 * NOTE: fallback 발신 주소(onboarding@resend.dev)는 의도적으로 제거.
 *  Resend 가 인증된 도메인이 아니면 실제 발송을 거부하기 때문에
 *  무의미한 실패 로그가 쌓이는 것을 방지.
 */
import { Resend } from 'resend'

let cached: Resend | null = null

export function getResend(): Resend | null {
  if (cached) return cached
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cached = new Resend(key)
  return cached
}

export function isEmailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY && !!process.env.EMAIL_FROM_ADDRESS
}

export function getFromAddress(): string | null {
  return process.env.EMAIL_FROM_ADDRESS || null
}
