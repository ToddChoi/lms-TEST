import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStripeServer } from '@/lib/stripe'
import { isEnrollable } from '@/lib/utils'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const supabase = createClient()

  // 로그인 확인
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const { course_id } = body as { course_id?: string }

  if (!course_id) {
    return NextResponse.json({ error: '강좌 ID가 필요합니다.' }, { status: 400 })
  }

  // 강좌 정보 조회 — P1-2 (2026-05-15): enroll_start/end/learn_end 추가.
  // enroll_*: 모집 기간 서버 검증 / learn_end: webhook 에서 expires_at 설정용 metadata.
  const { data: rawCourse } = await supabase
    .from('courses')
    .select('id, title, description, price, status, enroll_start, enroll_end, learn_end')
    .eq('id', course_id)
    .single()
  const course = rawCourse as unknown as {
    id: string
    title: string
    description: string | null
    price: number
    status: string
    enroll_start: string | null
    enroll_end: string | null
    learn_end: string | null
  } | null

  if (!course) {
    return NextResponse.json({ error: '존재하지 않는 강좌입니다.' }, { status: 404 })
  }

  if (course.status !== 'active') {
    return NextResponse.json({ error: '비활성 강좌입니다.' }, { status: 400 })
  }

  if (course.price <= 0) {
    return NextResponse.json(
      { error: '무료 강좌는 결제할 수 없습니다.' },
      { status: 400 }
    )
  }

  // P1-2 — 모집 기간 서버 검증 (UI 우회 방지).
  // 무료 신청과 동일 정책 (isEnrollable).
  if (!isEnrollable(course.enroll_start, course.enroll_end)) {
    return NextResponse.json(
      { error: '현재 결제 신청 가능한 기간이 아닙니다.' },
      { status: 400 }
    )
  }

  // 이미 수강 중인지 확인
  const { data: rawExisting } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', course_id)
    .eq('status', 'active')
    .maybeSingle()
  const existing = rawExisting as unknown as { id: string; status: string } | null

  if (existing) {
    return NextResponse.json(
      { error: '이미 수강 중인 강좌입니다.' },
      { status: 409 }
    )
  }

  // 결제 row 선 INSERT (pending)
  const { data: paymentRow, error: insertErr } = await (supabase as any)
    .from('payments')
    .insert({
      user_id: user.id,
      course_id: course.id,
      amount: course.price,
      currency: 'KRW',
      provider: 'stripe',
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertErr || !paymentRow) {
    return NextResponse.json(
      { error: '결제 준비 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }

  const paymentId = paymentRow.id as string
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  // Stripe Checkout Session 생성
  try {
    const stripe = getStripeServer()
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      currency: 'krw',
      line_items: [
        {
          price_data: {
            currency: 'krw',
            unit_amount: course.price,
            product_data: {
              name: course.title,
              ...(course.description
                ? { description: course.description.slice(0, 200) }
                : {}),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/my/courses?paid=1`,
      cancel_url: `${appUrl}/courses/${course.id}?cancelled=1`,
      metadata: {
        payment_id: paymentId,
        user_id: user.id,
        course_id: course.id,
        // P1-2 — webhook 에서 expires_at 으로 사용 (무료 enroll 과 정책 통일).
        // null 인 경우 (무제한 학습 기간) 빈 문자열로 전송.
        learn_end: course.learn_end ?? '',
      },
      customer_email: user.email ?? undefined,
    })

    // 세션 ID 업데이트
    await (supabase as any)
      .from('payments')
      .update({ stripe_session_id: session.id })
      .eq('id', paymentId)

    return NextResponse.json({ url: session.url })
  } catch (err) {
    // 실패한 pending row는 failed 로 마킹
    await (supabase as any)
      .from('payments')
      .update({ status: 'failed' })
      .eq('id', paymentId)

    const message = err instanceof Error ? err.message : 'Stripe 오류'
    return NextResponse.json(
      { error: `결제 세션 생성 실패: ${message}` },
      { status: 500 }
    )
  }
}
