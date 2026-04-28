/**
 * Resend 클라이언트 싱글톤.
 * RESEND_API_KEY 가 설정되어 있을 때만 실제 인스턴스를 만들고,
 * 미설정 시 null 을 반환해서 호출 측에서 skip 처리 합니다.
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
  return !!process.env.RESEND_API_KEY
}

export function getFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS || 'onboarding@resend.dev'
}
