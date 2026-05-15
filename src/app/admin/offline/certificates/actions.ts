'use server'

/**
 * Server Actions — 오프라인 수료증 발급.
 *
 * Phase B PoC: Route Handler (POST /api/admin/offline/certificates/issue) 를
 * Server Action 으로 마이그. form action 으로 직접 호출 → fetch + JSON parse 제거.
 *
 * 패턴 정립 (다른 form 마이그할 때 참고):
 *   1. 'use server' 디렉티브 (파일 최상단)
 *   2. action signature: async function(prevState, formData) → state
 *   3. requireAdmin() 가드는 그대로 — Server Action 도 Route Handler 와 동일하게 RLS 적용
 *   4. revalidatePath() 로 페이지 데이터 재갱신 (router.refresh() 대체)
 *   5. 결과 객체에 ok / errors 분기 → form 측 state 로 표시
 */

import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/app/api/admin/_guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OfflineCertificateIssuedEmail } from '@/lib/email/templates/offline-certificate-issued'
import { OfflineCertificatePDF } from '@/components/offline/OfflineCertificatePDF'
import { attendanceRateFromRows } from '@/lib/offline/attendance-rate'
import { formatDate } from '@/lib/utils'

export interface IssueState {
  ok: boolean
  issued: number
  skipped_existing: number
  skipped_low_rate: number
  errors: string[]
  /** 일반 에러 메시지 (권한 / validation 등). null 이면 정상 처리. */
  error: string | null
}

export const initialIssueState: IssueState = {
  ok: false,
  issued: 0,
  skipped_existing: 0,
  skipped_low_rate: 0,
  errors: [],
  error: null,
}

export async function issueCertificatesAction(
  _prevState: IssueState,
  formData: FormData,
): Promise<IssueState> {
  // ── 권한 ────────────────────────────────────────
  const { guard } = await requireAdmin()
  if (guard) {
    return { ...initialIssueState, error: '권한이 없습니다.' }
  }

  // ── 입력 ────────────────────────────────────────
  const session_id = String(formData.get('session_id') ?? '')
  const force = formData.get('force') === 'on'
  if (!session_id) {
    return { ...initialIssueState, error: '회차를 선택해주세요.' }
  }

  const admin = createAdminClient()

  // ── 회차 + 프로그램 fetch ──────────────────────
  const { data: rawSession } = await (admin as any)
    .from('offline_sessions')
    .select(`
      id, title, start_date, end_date, program_id,
      offline_programs ( id, title, slug, completion_attendance_rate )
    `)
    .eq('id', session_id)
    .is('deleted_at', null)
    .maybeSingle()
  const session = rawSession as unknown as {
    id: string
    title: string | null
    start_date: string
    end_date: string
    program_id: string
    offline_programs: {
      id: string
      title: string
      slug: string
      completion_attendance_rate: number
    } | null
  } | null

  if (!session || !session.offline_programs) {
    return { ...initialIssueState, error: '회차를 찾을 수 없습니다.' }
  }

  const program = session.offline_programs
  const cutoffRate = program.completion_attendance_rate

  // ── 회차 일자 수 ───────────────────────────────
  const { count: dayCount } = await (admin as any)
    .from('offline_session_days')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
  const totalDays = dayCount ?? 0
  if (totalDays === 0) {
    return { ...initialIssueState, error: '회차 일자가 없습니다.' }
  }

  // ── confirmed enrollments + attendees + attendance + 기존 cert ──
  const { data: rawEnrollments } = await (admin as any)
    .from('offline_enrollments')
    .select(`
      id, applicant_user_id, applicant_type,
      applicant:profiles!offline_enrollments_applicant_user_id_fkey(name, email)
    `)
    .eq('session_id', session.id)
    .eq('status', 'confirmed')
    .is('deleted_at', null)
  const enrollments = (rawEnrollments as unknown as Array<{
    id: string
    applicant_user_id: string
    applicant_type: 'individual' | 'corporate'
    applicant: { name: string | null; email: string | null } | null
  }>) ?? []

  const corpEnrollmentIds = enrollments.filter((e) => e.applicant_type === 'corporate').map((e) => e.id)
  const { data: rawAttendees } = corpEnrollmentIds.length
    ? await (admin as any)
        .from('offline_attendees')
        .select('id, enrollment_id, name, email, user_id')
        .in('enrollment_id', corpEnrollmentIds)
        .is('cancelled_at', null)
    : { data: [] }
  const attendees = (rawAttendees as unknown as Array<{
    id: string
    enrollment_id: string
    name: string
    email: string | null
    user_id: string | null
  }>) ?? []

  const enrollmentIds = enrollments.map((e) => e.id)
  const { data: rawAtt } = enrollmentIds.length
    ? await (admin as any)
        .from('offline_attendance')
        .select('enrollment_id, user_id, attendee_id, status')
        .in('enrollment_id', enrollmentIds)
    : { data: [] }
  const attendance = (rawAtt as unknown as Array<{
    enrollment_id: string
    user_id: string | null
    attendee_id: string | null
    status: 'present' | 'absent' | 'late'
  }>) ?? []

  const { data: rawExisting } = enrollmentIds.length
    ? await (admin as any)
        .from('offline_certificates')
        .select('enrollment_id, user_id, attendee_id')
        .in('enrollment_id', enrollmentIds)
    : { data: [] }
  const existing = (rawExisting as unknown as Array<{
    enrollment_id: string
    user_id: string | null
    attendee_id: string | null
  }>) ?? []

  function isAlreadyIssued(enrollmentId: string, userId: string | null, attendeeId: string | null): boolean {
    return existing.some((c) =>
      c.enrollment_id === enrollmentId &&
      ((attendeeId && c.attendee_id === attendeeId) ||
       (userId && c.user_id === userId))
    )
  }

  const sessionPeriod =
    session.start_date === session.end_date
      ? formatDate(session.start_date)
      : `${formatDate(session.start_date)} ~ ${formatDate(session.end_date)}`

  const result: IssueState = {
    ok: true,
    issued: 0,
    skipped_existing: 0,
    skipped_low_rate: 0,
    errors: [],
    error: null,
  }

  type Recipient = {
    enrollmentId: string
    userId: string | null
    attendeeId: string | null
    name: string
    email: string | null
  }
  const recipients: Recipient[] = []
  for (const e of enrollments) {
    if (e.applicant_type === 'individual') {
      recipients.push({
        enrollmentId: e.id,
        userId: e.applicant_user_id,
        attendeeId: null,
        name: e.applicant?.name ?? '(이름 없음)',
        email: e.applicant?.email ?? null,
      })
    } else {
      const corpAtt = attendees.filter((a) => a.enrollment_id === e.id)
      for (const a of corpAtt) {
        recipients.push({
          enrollmentId: e.id,
          userId: a.user_id,
          attendeeId: a.id,
          name: a.name,
          email: a.email,
        })
      }
    }
  }

  for (const r of recipients) {
    if (isAlreadyIssued(r.enrollmentId, r.userId, r.attendeeId)) {
      result.skipped_existing++
      continue
    }

    const rows = attendance.filter((a) =>
      a.enrollment_id === r.enrollmentId &&
      ((r.attendeeId && a.attendee_id === r.attendeeId) ||
       (!r.attendeeId && a.user_id === r.userId))
    )
    const att = attendanceRateFromRows(rows, totalDays)

    if (!force && att.rate < cutoffRate) {
      result.skipped_low_rate++
      continue
    }

    try {
      const year = new Date().getFullYear()
      const slugPart = program.slug.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase().padEnd(4, 'X')
      const randPart = Math.random().toString(36).slice(2, 6).toUpperCase()
      const certificateNumber = `OFF-${year}-${slugPart}-${randPart}`
      const issuedAt = new Date().toISOString()

      const buffer = await renderToBuffer(
        React.createElement(OfflineCertificatePDF, {
          recipientName: r.name,
          programTitle: program.title,
          sessionLabel: session.title ?? '',
          sessionPeriod,
          attendanceRate: att.rate,
          certificateNumber,
          issuedAt: issuedAt.slice(0, 10),
        }) as React.ReactElement
      )

      const filePath = `offline/${session.id}/${certificateNumber}.pdf`
      const { error: uploadErr } = await (admin as any)
        .storage.from('certificates')
        .upload(filePath, buffer, {
          contentType: 'application/pdf',
          upsert: true,
        })
      if (uploadErr) {
        result.errors.push(`${r.name}: storage upload failed — ${uploadErr.message}`)
        continue
      }

      const { data: rawCert, error: insertErr } = await (admin as any)
        .from('offline_certificates')
        .insert({
          program_id: program.id,
          session_id: session.id,
          enrollment_id: r.enrollmentId,
          user_id: r.userId,
          attendee_id: r.attendeeId,
          certificate_number: certificateNumber,
          attendance_rate: att.rate,
          issued_at: issuedAt,
          pdf_url: filePath,
        })
        .select('id')
        .single()

      if (insertErr) {
        result.errors.push(`${r.name}: DB insert failed — ${insertErr.message}`)
        continue
      }

      const certId = (rawCert as { id: string }).id
      result.issued++

      if (r.email) {
        try {
          await sendEmail({
            to: r.email,
            subject: `[수료증 발급] ${program.title}`,
            template: 'offline-certificate-issued',
            userId: r.userId ?? undefined,
            react: OfflineCertificateIssuedEmail({
              name: r.name,
              programTitle: program.title,
              sessionLabel: session.title ?? '',
              attendanceRate: att.rate,
              certificateNumber,
              certificateId: certId,
            }),
          })
          await (admin as any).from('offline_notifications').insert({
            enrollment_id: r.enrollmentId,
            user_id: r.userId,
            type: 'certificate_issued',
            channels: ['email'],
            scheduled_at: new Date().toISOString(),
            subject: `[수료증 발급] ${program.title}`,
            status: 'sent',
            email_sent_at: new Date().toISOString(),
          })
        } catch (mailErr) {
          console.warn('[cert issue] email failed:', r.name, mailErr)
        }
      }
    } catch (err) {
      result.errors.push(`${r.name}: ${err instanceof Error ? err.message : 'unknown'}`)
    }
  }

  // 발급 완료 후 페이지 재갱신 (router.refresh() 대체)
  revalidatePath('/admin/offline/certificates')

  return result
}
