import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * 온라인 강좌 enrollments 자동 만료 cron.
 *
 * 동작:
 *   status='active' AND expires_at IS NOT NULL AND expires_at < now()
 *     → status='expired'
 *
 * 매일 새벽 1시 KST 실행 (vercel.json 의 "0 16 * * *" UTC = 01:00 KST).
 *
 * 인증:
 *   Vercel Cron 은 자동으로 Authorization: Bearer ${CRON_SECRET} 헤더를 붙임.
 *   CRON_SECRET 미설정 시 외부 호출 차단 (500).
 *
 * 멱등:
 *   같은 row 에 두 번 적용해도 무동작 (이미 expired 면 WHERE status='active' 미스).
 *
 * 부수효과 차단:
 *   - 학습/진도 차단은 이미 isEnrollmentActive() query-time guard 가 처리 중 (commit 9f1f40f).
 *   - 본 cron 의 목적은 통계/관리자 화면의 정확한 상태 표시.
 */
export async function GET(request: Request) {
  // Vercel Cron 인증
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // active + 과거 만료일 row 만 expired 로 전이
  const { data, error } = await (admin as any)
    .from('enrollments')
    .update({ status: 'expired' })
    .eq('status', 'active')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id')

  if (error) {
    console.error('[cron expire-enrollments] update failed:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const updatedCount = Array.isArray(data) ? data.length : 0
  return NextResponse.json({
    ok: true,
    updated: updatedCount,
    at: now,
  })
}

// Vercel Cron 은 GET 만 보내지만, 수동 트리거용으로 POST 도 동일 처리
export const POST = GET
