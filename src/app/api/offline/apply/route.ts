import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripeServer } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ApplyBody {
  session_id?: string
  payment_method?: 'card' | 'invoice'
  // Phase 3 — corporate / attendee_count / company_id
}

/**
 * 오프라인 회차 신청 (개인 + 카드 결제).
 *
 * 흐름:
 *   1. 로그인 확인
 *   2. RPC offline_create_enrollment 호출 (SECURITY DEFINER — RLS 우회)
 *      - FOR UPDATE 회차 행 락 + 잔여석 검증 + payment_due_at 계산
 *      - 'pending_payment' 상태 enrollment 생성
 *   3. payment_method='card' → Stripe Checkout 세션 생성 + enrollment 에 stripe_session_id 박음
 *   4. URL 반환 (클라이언트가 window.location 으로 이동)
 *
 * Phase 2 한계: 개인 (individual) + 카드만. invoice / corporate 는 Phase 3.
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
  const { session_id, payment_method } = body

  if (!session_id) {
    return NextResponse.json({ error: '회차 ID 가 필요합니다.' }, { status: 400 })
  }
  if (payment_method !== 'card') {
    // invoice / corporate 는 Phase 3 에서 활성화
    return NextResponse.json(
      { error: '현재는 개인 신청 + 카드 결제만 지원합니다. (세금계산서 결제는 곧 오픈됩니다.)' },
      { status: 400 }
    )
  }

  // RPC 호출 — SECURITY DEFINER 라 anon RLS 우회. 회차 행 락 + 잔여석 검증 내장.
  const { data: rpcData, error: rpcError } = await (supabase as any).rpc(
    'offline_create_enrollment',
    {
      p_session_id: session_id,
      p_applicant_id: user.id,
      p_applicant_type: 'individual',
      p_attendee_count: 1,
      p_company_id: null,
      p_payment_method: 'card',
    }
  )
  if (rpcError) {
    // RAISE EXCEPTION 의 메시지가 rpcError.message 에 그대로 옴
    return NextResponse.json({ error: rpcError.message }, { status: 400 })
  }
  const enrollmentId = rpcData as string

  // 가격 / 금액 — enrollment 에 이미 스냅샷 저장됐음. 결제 금액 가져옴.
  const { data: rawEnrollment } = await supabase
    .from('offline_enrollments')
    .select('id, total_amount, session_id')
    .eq('id', enrollmentId)
    .single()
  const enrollment = rawEnrollment as unknown as {
    id: string
    total_amount: number
    session_id: string
  } | null
  if (!enrollment) {
    return NextResponse.json({ error: '신청 생성 후 조회 실패.' }, { status: 500 })
  }

  // 회차 + 프로그램 정보 (Stripe 결제 description 용)
  const { data: rawSession } = await supabase
    .from('offline_sessions')
    .select('title, start_date, end_date, offline_programs(title, slug)')
    .eq('id', enrollment.session_id)
    .single()
  const session = rawSession as unknown as {
    title: string | null
    start_date: string
    end_date: string
    offline_programs: { title: string; slug: string } | null
  } | null

  const programTitle = session?.offline_programs?.title ?? '오프라인 교육'
  const programSlug = session?.offline_programs?.slug ?? ''
  const sessionLabel = session?.title
    ? `${programTitle} — ${session.title}`
    : programTitle

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Stripe Checkout 세션 생성
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
        ? `${appUrl}/offline/${programSlug}/apply/${session?.start_date ? enrollment.session_id : enrollment.session_id}/success?enrollment_id=${enrollmentId}`
        : `${appUrl}/my?paid=1`,
      cancel_url: programSlug
        ? `${appUrl}/offline/${programSlug}?cancelled=1`
        : `${appUrl}/offline`,
      metadata: {
        // ★ webhook 멱등성: enrollment_id 가 source of truth
        enrollment_id: enrollmentId,
        user_id: user.id,
        offline: '1',
      },
      customer_email: user.email ?? undefined,
    })

    // enrollment 에 stripe_session_id 박기 (멱등성 partial UNIQUE index 활용)
    await (supabase as any)
      .from('offline_enrollments')
      .update({ stripe_session_id: checkoutSession.id })
      .eq('id', enrollmentId)

    return NextResponse.json({ url: checkoutSession.url, enrollment_id: enrollmentId })
  } catch (err) {
    // Checkout 생성 실패 시 enrollment 는 그대로 남김 (cron 이 만료 처리).
    // admin client 로 status='cancelled' 즉시 처리하면 더 깔끔하지만, 상태 전이
    // 트리거 통과 OK (pending_payment → cancelled). admin client 로 처리.
    try {
      const admin = createAdminClient()
      await (admin as any)
        .from('offline_enrollments')
        .update({
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
          cancelled_by: 'system_expired',
          notes: 'Stripe Checkout 생성 실패',
        })
        .eq('id', enrollmentId)
    } catch {
      // best effort
    }

    const message = err instanceof Error ? err.message : 'Stripe 오류'
    return NextResponse.json(
      { error: `결제 세션 생성 실패: ${message}` },
      { status: 500 }
    )
  }
}
