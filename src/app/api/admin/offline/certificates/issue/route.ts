import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { requireAdmin } from '@/app/api/admin/_guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { OfflineCertificateIssuedEmail } from '@/lib/email/templates/offline-certificate-issued'
import { OfflineCertificatePDF } from '@/components/offline/OfflineCertificatePDF'
import { attendanceRateFromRows } from '@/lib/offline/attendance-rate'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60  // PDF 생성 + Storage upload 시간 여유

interface PostBody {
  session_id?: string
  /** 강제 발급 (수료 기준 미달이어도) — 운영 권한 */
  force?: boolean
}

/**
 * 수료증 일괄 발급 — POST /api/admin/offline/certificates/issue
 *
 * 흐름:
 *   1. session_id → 회차 + 프로그램 + completion_attendance_rate 가져오기
 *   2. 회차의 일자 수 (totalDays) 계산
 *   3. confirmed enrollment 의 모든 참석자 (개인 + 단체 attendees) 추출
 *   4. 참석자별 출석률 계산 (offline_attendance LEFT JOIN)
 *   5. 출석률 ≥ completion_attendance_rate 이거나 force=true 인 사람만 발급
 *   6. 이미 발급된 (offline_certificates) 사람은 skip (멱등)
 *   7. PDF 생성 → Storage 'certificates' bucket 업로드 → URL 저장
 *   8. offline_certificates INSERT + certificate_issued 메일
 *
 * 응답: { ok, issued: N, skipped_existing: N, skipped_low_rate: N, errors[] }
 */
export async function POST(req: NextRequest) {
  const { guard } = await requireAdmin()
  if (guard) return guard

  const body = (await req.json().catch(() => ({}))) as PostBody
  const { session_id, force = false } = body
  if (!session_id) {
    return NextResponse.json({ error: 'session_id 필수' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 회차 + 프로그램 fetch
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
    return NextResponse.json({ error: '회차를 찾을 수 없습니다.' }, { status: 404 })
  }

  const program = session.offline_programs
  const cutoffRate = program.completion_attendance_rate

  // 회차 일자 수
  const { count: dayCount } = await (admin as any)
    .from('offline_session_days')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', session.id)
  const totalDays = dayCount ?? 0
  if (totalDays === 0) {
    return NextResponse.json({ error: '회차 일자가 없습니다.' }, { status: 400 })
  }

  // confirmed enrollment 의 모든 참석자 (roster)
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

  // 모든 출석 기록
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

  // 이미 발급된 cert
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

  const result = {
    ok: true,
    issued: 0,
    skipped_existing: 0,
    skipped_low_rate: 0,
    errors: [] as string[],
  }

  // 참석자별 처리
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
    // 이미 발급?
    if (isAlreadyIssued(r.enrollmentId, r.userId, r.attendeeId)) {
      result.skipped_existing++
      continue
    }

    // 출석률
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
      // 수료번호 — OFF-YYYY-{slug 4자}-{rand 4}
      const year = new Date().getFullYear()
      const slugPart = program.slug.replace(/[^a-z0-9]/gi, '').slice(0, 4).toUpperCase().padEnd(4, 'X')
      const randPart = Math.random().toString(36).slice(2, 6).toUpperCase()
      const certificateNumber = `OFF-${year}-${slugPart}-${randPart}`
      const issuedAt = new Date().toISOString()

      // PDF 생성
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

      // Storage 업로드 (certificates bucket — private)
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

      // offline_certificates INSERT
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
          pdf_url: filePath,  // path 만 저장 (signed URL 은 다운로드 시 생성)
        })
        .select('id')
        .single()

      if (insertErr) {
        result.errors.push(`${r.name}: DB insert failed — ${insertErr.message}`)
        continue
      }

      const certId = (rawCert as { id: string }).id
      result.issued++

      // 메일 (best-effort)
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

  return NextResponse.json(result)
}
