/**
 * 이메일 발송 공통 함수.
 *
 * - RESEND_API_KEY 미설정 시 자동 skip (앱 정상 동작 보장)
 * - 모든 발송 시도는 notification_logs 에 기록
 * - 사용자 알림 설정이 OFF 인 경우 skip (옵션)
 *
 * 사용 예:
 *   await sendEmail({
 *     to: 'user@example.com',
 *     subject: '환영합니다',
 *     react: <WelcomeEmail name="홍길동" />,
 *     template: 'welcome',
 *     userId: 'uuid',
 *   })
 */

import { ReactElement } from 'react'
import { createClient as createAdmin } from '@supabase/supabase-js'
import { getResend, isEmailEnabled, getFromAddress } from './client'

export type EmailTemplate =
  | 'welcome'
  | 'enrollment'
  | 'completion'
  | 'certificate'
  | 'contact-admin'
  | 'contact-user'

/** 사용자 알림 설정에서 OFF 인 경우 skip 할 키 매핑 */
const PREFERENCE_KEY: Partial<Record<EmailTemplate, string>> = {
  enrollment:  'email_enrollment',
  completion:  'email_completion',
  certificate: 'email_certificate',
  // welcome / contact-* 는 항상 발송 (시스템 메일)
}

interface SendEmailParams {
  to: string | string[]
  subject: string
  react: ReactElement
  template: EmailTemplate
  userId?: string | null
  payload?: Record<string, unknown>
}

interface SendEmailResult {
  ok: boolean
  skipped?: boolean
  reason?: string
  id?: string
  error?: string
}

function makeAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  return createAdmin(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function checkUserPreference(
  userId: string,
  template: EmailTemplate
): Promise<boolean> {
  const prefKey = PREFERENCE_KEY[template]
  if (!prefKey) return true // 시스템 메일은 항상 ON
  const admin = makeAdminClient()
  if (!admin) return true
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (admin as any)
    .from('user_notification_preferences')
    .select(prefKey)
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return true // 설정 없음 → 기본 ON 처리
  return Boolean(data[prefKey])
}

async function logNotification(args: {
  template: EmailTemplate
  recipient: string
  userId: string | null
  status: 'sent' | 'skipped' | 'failed'
  error?: string
  payload?: Record<string, unknown>
}) {
  const admin = makeAdminClient()
  if (!admin) return
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (admin as any).from('notification_logs').insert({
      type: 'email',
      template: args.template,
      recipient: args.recipient,
      user_id: args.userId,
      status: args.status,
      error: args.error ?? null,
      payload: args.payload ?? null,
      sent_at: args.status === 'sent' ? new Date().toISOString() : null,
    })
  } catch (e) {
    // 로그 기록 실패는 무시 (메일 발송 자체엔 영향 없음)
    console.warn('[email] log insert failed:', e)
  }
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, react, template, userId, payload } = params
  const recipient = Array.isArray(to) ? to.join(',') : to

  // 1) 키 미설정 → skip
  if (!isEmailEnabled()) {
    console.warn('[email] RESEND_API_KEY 미설정 — 발송 생략:', template, '→', recipient)
    await logNotification({ template, recipient, userId: userId ?? null, status: 'skipped', error: 'RESEND_API_KEY missing' })
    return { ok: true, skipped: true, reason: 'no api key' }
  }

  // 2) 사용자 설정 OFF → skip
  if (userId) {
    const allowed = await checkUserPreference(userId, template)
    if (!allowed) {
      await logNotification({ template, recipient, userId, status: 'skipped', error: 'user opted out' })
      return { ok: true, skipped: true, reason: 'user opted out' }
    }
  }

  // 3) 실제 발송
  const resend = getResend()
  const from = getFromAddress()
  if (!resend || !from) {
    await logNotification({ template, recipient, userId: userId ?? null, status: 'skipped', error: 'resend client or from address missing' })
    return { ok: true, skipped: true, reason: 'resend not initialized' }
  }

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      react,
    })
    if (error) {
      await logNotification({ template, recipient, userId: userId ?? null, status: 'failed', error: error.message, payload })
      return { ok: false, error: error.message }
    }
    await logNotification({ template, recipient, userId: userId ?? null, status: 'sent', payload })
    return { ok: true, id: data?.id }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error'
    await logNotification({ template, recipient, userId: userId ?? null, status: 'failed', error: msg, payload })
    return { ok: false, error: msg }
  }
}
