import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/offline/waitlist/[id] — 사용자 대기 취소.
 *
 * 검증: 본인 대기열 row 만 삭제 (user_id = auth.uid()).
 * waiting / notified 둘 다 취소 가능. converted / expired 는 이미 종료.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const admin = createAdminClient()

  // 본인 row 인지 확인 + 활성 상태인지
  const { data: rawWaiter } = await (admin as any)
    .from('offline_waitlist')
    .select('id, user_id, status')
    .eq('id', params.id)
    .maybeSingle()
  const waiter = rawWaiter as { id: string; user_id: string; status: string } | null
  if (!waiter) {
    return NextResponse.json({ error: '대기열 항목을 찾을 수 없습니다.' }, { status: 404 })
  }
  if (waiter.user_id !== user.id) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
  }
  if (!['waiting', 'notified'].includes(waiter.status)) {
    return NextResponse.json(
      { error: `이미 ${waiter.status} 상태입니다.` },
      { status: 400 }
    )
  }

  // hard delete (대기열은 audit 가치 낮음)
  const { error } = await (admin as any)
    .from('offline_waitlist')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
