import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { getStripeServer } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const sig = request.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: 'Webhook secret not configured' },
      { status: 500 }
    )
  }

  // Stripe signature 검증에는 raw body 가 필요 — json() 금지
  const body = await request.text()

  const stripe = getStripeServer()
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, secret)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid'
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const metadata = session.metadata ?? {}
        const paymentId = metadata.payment_id
        const userId = metadata.user_id
        const courseId = metadata.course_id

        if (!paymentId || !userId || !courseId) {
          return NextResponse.json({ received: true })
        }

        // payment_intent 확장 시 receipt_url 추출
        let receiptUrl: string | null = null
        let paymentIntentId: string | null = null

        if (session.payment_intent) {
          paymentIntentId =
            typeof session.payment_intent === 'string'
              ? session.payment_intent
              : session.payment_intent.id

          try {
            const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
              expand: ['latest_charge'],
            })
            const charge = pi.latest_charge as Stripe.Charge | null
            if (charge && charge.receipt_url) {
              receiptUrl = charge.receipt_url
            }
          } catch {
            // receipt_url 실패 무시
          }
        }

        // 결제 성공 업데이트
        await (admin as any)
          .from('payments')
          .update({
            status: 'succeeded',
            stripe_payment_intent_id: paymentIntentId,
            receipt_url: receiptUrl,
          })
          .eq('id', paymentId)

        // 수강 등록 — 중복 시 무시
        const { data: rawExisting } = await admin
          .from('enrollments')
          .select('id, status')
          .eq('user_id', userId)
          .eq('course_id', courseId)
          .maybeSingle()
        const existing = rawExisting as unknown as {
          id: string
          status: string
        } | null

        if (!existing) {
          await (admin as any).from('enrollments').insert({
            user_id: userId,
            course_id: courseId,
            status: 'active',
          })
        } else if (existing.status !== 'active') {
          await (admin as any)
            .from('enrollments')
            .update({
              status: 'active',
              enrolled_at: new Date().toISOString(),
            })
            .eq('id', existing.id)
        }
        break
      }

      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        const paymentId = session.metadata?.payment_id
        if (paymentId) {
          await (admin as any)
            .from('payments')
            .update({ status: 'failed' })
            .eq('id', paymentId)
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const paymentId = pi.metadata?.payment_id
        if (paymentId) {
          await (admin as any)
            .from('payments')
            .update({ status: 'failed' })
            .eq('id', paymentId)
        } else if (pi.id) {
          // fallback — payment_intent id 로 매칭
          await (admin as any)
            .from('payments')
            .update({ status: 'failed' })
            .eq('stripe_payment_intent_id', pi.id)
        }
        break
      }

      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook handler error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
