import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServer } from '@/lib/stripe'
import { sendEmail } from '@/lib/email/send'
import { OfflineApplicationReceivedEmail } from '@/lib/email/templates/offline-application-received'
import { formatDate } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface AttendeeInput {
  name?: string
  email?: string | null
  phone?: string | null
  department?: string | null
  position?: string | null
}

interface ApplyBody {
  session_id?: string
  applicant_type?: 'individual' | 'corporate'
  payment_method?: 'card' | 'invoice'
  // corporate 만
  company_id?: string
  company_contact_name?: string
  company_contact_email?: string
  company_contact_phone?: string
  attendees?: AttendeeInput[]
}

const MAX_ATTENDEES = 500

/**
 * 오프라인 회차 신청 (개인 + 기업 단체 / 카드 + 세금계산서).
 *
 * 흐름:
 *   1. 로그인 확인
 *   2. body 검증 — applicant_type / payment_method 조합 유효성
 *   3. corporate: company_members 검증 (본인이 그 회사 멤버인지)
 *   4. RPC offline_create_enrollment (FOR UPDATE + 정원 + 가격 스냅샷)
 *   5. corporate: offline_attendees 다건 INSERT (sync 트리거가 attendee_count 자동 갱신)
 *   6. invoice: 담당자 / 단체 contact 컬럼 + payment_method='invoice' UPDATE
 *   7. card: Stripe Checkout → redirect_url 반환
 *      invoice: 입금 안내 페이지 URL 반환
 *   8. application_received 메일 발송 + offline_notifications 기록
 *
 * 응답:
 *   { redirect_url: string, enrollment_id: string }
 */
export async function POST(request: Request) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as ApplyBody
  const {
    session_id,
    applicant_type = 'individual',
    payment_method,
  } = body

  // ─── 1. 기본 검증 ───────────────────────────────────────
  if (!session_id) {
    return NextResponse.json({ error: '회차 ID 가 필요합니다.' }, { status: 400 })
  }
  if (applicant_type !== 'individual' && applicant_type !== 'corporate') {
    return NextResponse.json({ error: '잘못된 신청 유형입니다.' }, { status: 400 })
  }
  if (payment_method !== 'card' && payment_method !== 'invoice') {
    return NextResponse.json({ error: '결제 방식이 잘못되었습니다.' }, { status: 400 })
  }
  // 개인 신청은 세금계산서 결제 불가 (PRD §7-3)
  if (applicant_type === 'individual' && payment_method === 'invoice') {
    return NextResponse.json(
      { error: '개인 신청은 카드 결제만 가능합니다.' },
      { status: 400 }
    )
  }

  // ─── 2. corporate 추가 검증 ─────────────────────────────
  let attendeeCount = 1
  let attendees: AttendeeInput[] = []
  let companyId: string | null = null

  if (applicant_type === 'corporate') {
    const cName = body.company_contact_name?.trim()
    const cEmail = body.company_contact_email?.trim()
    const cPhone = body.company_contact_phone?.trim()
    if (!body.company_id || !cName || !cEmail || !cPhone) {
      return NextResponse.json(
        { error: '단체 신청은 회사 / 담당자 정보가 모두 필요합니다.' },
        { status: 400 }
      )
    }
    if (!Array.isArray(body.attendees) || body.attendees.length === 0) {
      return NextResponse.json({ error: '참석자 1명 이상 입력해주세요.' }, { status: 400 })
    }
    if (body.attendees.length > MAX_ATTENDEES) {
      return NextResponse.json(
        { error: `참석자는 최대 ${MAX_ATTENDEES}명까지 가능합니다.` },
        { status: 400 }
      )
    }
    // 참석자 검증 — 모두 name 필수
    attendees = body.attendees.map((a) => ({
      name: (a.name ?? '').toString().trim(),
      email: (a.email ?? null) ? String(a.email).trim() || null : null,
      phone: (a.phone ?? null) ? String(a.phone).trim() || null : null,
      department: (a.department ?? null) ? String(a.department).trim() || null : null,
      position: (a.position ?? null) ? String(a.position).trim() || null : null,
    }))
    for (let i = 0; i < attendees.length; i++) {
      if (!attendees[i].name) {
        return NextResponse.json(
          { error: `${i + 1}번째 참석자: 이름이 비어 있습니다.` },
          { status: 400 }
        )
      }
    }
    attendeeCount = attendees.length

    // P2-4c (2026-05-15) — 권한 정책 강화.
    // 일반 회사 멤버도 corporate (최대 500명, 후불 invoice 결제) 신청 가능했던 문제 차단.
    //
    // 정책: corporate 신청은 다음 중 하나만 가능 —
    //   1) 회사 매니저 (company_members.is_manager = true)
    //   2) 서비스 admin / superadmin / org_admin (profile.role)
    // 일반 멤버는 카드 결제 개인 신청만 가능. 단체 신청 필요 시 회사 매니저에게 요청.
    const admin = createAdminClient()
    const { data: rawMembership } = await (admin as any)
      .from('company_members')
      .select('company_id, is_manager')
      .eq('user_id', user.id)
      .eq('company_id', body.company_id)
      .maybeSingle()
    const membership = rawMembership as { company_id: string; is_manager: boolean } | null
    if (!membership) {
      return NextResponse.json(
        { error: '해당 회사의 멤버가 아닙니다. 운영팀에 문의해주세요.' },
        { status: 403 }
      )
    }

    // 권한: is_manager OR 서비스 admin/superadmin/org_admin 중 하나
    const { data: rawProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    const role = (rawProfile as { role: string } | null)?.role
    const isServiceAdmin = role && ['admin', 'superadmin', 'org_admin'].includes(role)
    if (!membership.is_manager && !isServiceAdmin) {
      return NextResponse.json(
        {
          error:
            '기업 단체 신청은 회사 매니저 또는 운영자만 가능합니다. 회사 매니저에게 신청을 요청하거나 운영팀에 문의해주세요.',
        },
        { status: 403 }
      )
    }
    companyId = body.company_id
  }

  // ─── 3. RPC offline_create_enrollment ───────────────────
  // SECURITY DEFINER + FOR UPDATE — 동시 신청 직렬화 + 잔여석 검증 + 가격 스냅샷.
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
    'offline_create_enrollment',
    {
      p_session_id: session_id,
      p_applicant_id: user.id,
      p_applicant_type: applicant_type,
      p_attendee_count: attendeeCount,
      p_company_id: companyId,
      p_payment_method: payment_method,
    }
  )
  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 400 })
  }
  const enrollmentId = rpcData as string

  // ─── 4. corporate: attendees INSERT + 담당자 정보 UPDATE ─
  const admin = createAdminClient()
  if (applicant_type === 'corporate' && companyId) {
    // attendees 다건 INSERT — sync_enrollment_attendee_count 트리거가 enrollment.attendee_count 자동 갱신
    const attendeesRows = attendees.map((a) => ({
      enrollment_id: enrollmentId,
      name: a.name!,
      email: a.email,
      phone: a.phone,
      department: a.department,
      position: a.position,
    }))
    const { error: attendeesErr } = await (admin as any)
      .from('offline_attendees')
      .insert(attendeesRows)
    if (attendeesErr) {
      // 롤백 — enrollment 자동 취소 (best effort)
      await (admin as any)
        .from('offline_enrollments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'system_expired',
          notes: `참석자 INSERT 실패: ${attendeesErr.message}`,
        })
        .eq('id', enrollmentId)
      return NextResponse.json(
        { error: `참석자 등록 실패: ${attendeesErr.message}` },
        { status: 500 }
      )
    }

    // 단체 contact 정보 + payment_method 박기 (RPC 가 payment_method 받지만 invoice 일관성)
    await (admin as any)
      .from('offline_enrollments')
      .update({
        company_contact_name: body.company_contact_name!.trim(),
        company_contact_email: body.company_contact_email!.trim(),
        company_contact_phone: body.company_contact_phone!.trim(),
      })
      .eq('id', enrollmentId)
  }

  // ─── 5. enrollment 재조회 (가격 / 결제기한 / 회차정보) ──
  const { data: rawEnrollment } = await supabase
    .from('offline_enrollments')
    .select('id, total_amount, session_id, vat_included, payment_due_at')
    .eq('id', enrollmentId)
    .single()
  const enrollment = rawEnrollment as unknown as {
    id: string
    total_amount: number
    session_id: string
    vat_included: boolean
    payment_due_at: string
  } | null
  if (!enrollment) {
    return NextResponse.json({ error: '신청 생성 후 조회 실패.' }, { status: 500 })
  }

  const { data: rawSession } = await supabase
    .from('offline_sessions')
    .select('title, start_date, end_date, location_name, offline_programs(title, slug)')
    .eq('id', enrollment.session_id)
    .single()
  const session = rawSession as unknown as {
    title: string | null
    start_date: string
    end_date: string
    location_name: string | null
    offline_programs: { title: string; slug: string } | null
  } | null

  const programTitle = session?.offline_programs?.title ?? '오프라인 교육'
  const programSlug = session?.offline_programs?.slug ?? ''
  const sessionLabel = session?.title
    ? `${programTitle} — ${session.title}`
    : programTitle

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // ─── 6. 결제 분기 ────────────────────────────────────────
  let redirectUrl: string

  if (payment_method === 'invoice') {
    // 입금 안내 페이지로 redirect (관리자 입금 확인 대기)
    redirectUrl = programSlug
      ? `${appUrl}/offline/${programSlug}/apply/${session_id}/invoice-success?enrollment_id=${enrollmentId}`
      : `${appUrl}/my/offline/${enrollmentId}`
  } else {
    // Stripe Checkout
    try {
      const stripe = getStripeServer()
      const checkoutSession = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        currency: 'krw',
        line_items: [
          {
            price_data: {
              currency: 'krw',
              unit_amount: enrollment.total_amount,
              product_data: {
                name: sessionLabel,
                description: session
                  ? `${session.start_date}${session.end_date !== session.start_date ? ` ~ ${session.end_date}` : ''}`
                  : undefined,
              },
            },
            quantity: 1,
          },
        ],
        success_url: programSlug
          ? `${appUrl}/offline/${programSlug}/apply/${session_id}/success?enrollment_id=${enrollmentId}`
          : `${appUrl}/my?paid=1`,
        cancel_url: programSlug
          ? `${appUrl}/offline/${programSlug}?cancelled=1`
          : `${appUrl}/offline`,
        metadata: {
          enrollment_id: enrollmentId,
          user_id: user.id,
          offline: '1',
        },
        customer_email: user.email ?? undefined,
      })

      await (admin as any)
        .from('offline_enrollments')
        .update({ stripe_session_id: checkoutSession.id })
        .eq('id', enrollmentId)

      redirectUrl = checkoutSession.url!
    } catch (err) {
      // Checkout 실패 → enrollment 자동 cancelled (admin)
      await (admin as any)
        .from('offline_enrollments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'system_expired',
          notes: 'Stripe Checkout 생성 실패',
        })
        .eq('id', enrollmentId)
      const message = err instanceof Error ? err.message : 'Stripe 오류'
      return NextResponse.json(
        { error: `결제 세션 생성 실패: ${message}` },
        { status: 500 }
      )
    }
  }

  // ─── 7. 신청 접수 메일 (best effort) ────────────────────
  // 개인 → 본인 user.email / 단체 → company_contact_email (담당자)
  const recipientEmail =
    applicant_type === 'corporate' ? body.company_contact_email?.trim() : user.email
  const recipientName =
    applicant_type === 'corporate' ? body.company_contact_name?.trim() : null

  if (recipientEmail && session) {
    try {
      let displayName = recipientName
      if (!displayName) {
        const { data: rawProfile } = await supabase
          .from('profiles').select('name').eq('id', user.id).maybeSingle()
        displayName = (rawProfile as unknown as { name: string | null } | null)?.name ?? null
      }

      const sessionPeriod =
        session.start_date === session.end_date
          ? formatDate(session.start_date)
          : `${formatDate(session.start_date)} ~ ${formatDate(session.end_date)}`

      const emailRes = await sendEmail({
        to: recipientEmail,
        subject: `[신청 접수] ${programTitle}`,
        template: 'offline-application-received',
        userId: user.id,
        react: OfflineApplicationReceivedEmail({
          name: displayName,
          programTitle,
          sessionLabel: session.title ?? '',
          sessionPeriod,
          locationName: session.location_name,
          totalAmount: enrollment.total_amount,
          vatIncluded: enrollment.vat_included,
          paymentDueAt: enrollment.payment_due_at,
          enrollmentId,
        }),
      })

      await (admin as any).from('offline_notifications').insert({
        enrollment_id: enrollmentId,
        user_id: user.id,
        type: 'application_received',
        channels: ['email'],
        scheduled_at: new Date().toISOString(),
        subject: `[신청 접수] ${programTitle}`,
        status: emailRes.ok ? 'sent' : 'failed',
        email_sent_at: emailRes.ok && !emailRes.skipped ? new Date().toISOString() : null,
        error_message: emailRes.error ?? (emailRes.skipped ? emailRes.reason : null),
      })
    } catch (e) {
      console.warn('[offline apply] notification dispatch failed:', e)
    }
  }

  return NextResponse.json({ redirect_url: redirectUrl, enrollment_id: enrollmentId })
}
