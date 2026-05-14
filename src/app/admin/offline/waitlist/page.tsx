import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '대기열 관리' }
export const dynamic = 'force-dynamic'

type WaitlistStatus = 'waiting' | 'notified' | 'converted' | 'expired'

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  waiting: '대기',
  notified: '자리 알림',
  converted: '결제 전환',
  expired: '기한 만료',
}
const STATUS_CLASS: Record<WaitlistStatus, string> = {
  waiting: 'bg-amber-50 text-amber-700',
  notified: 'bg-green-100 text-green-700',
  converted: 'bg-blue-50 text-blue-700',
  expired: 'bg-gray-100 text-gray-500',
}

interface Row {
  id: string
  session_id: string
  attendee_count: number
  status: WaitlistStatus
  notified_at: string | null
  reservation_deadline: string | null
  created_at: string
  user: { name: string | null; email: string | null } | null
  offline_sessions: {
    title: string | null
    start_date: string
    end_date: string
    offline_programs: { title: string } | null
  } | null
}

export default async function AdminOfflineWaitlistPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // 활성 대기열만 (waiting / notified) — created_at ASC
  const { data: rawRows } = await supabase
    .from('offline_waitlist')
    .select(`
      id, session_id, attendee_count, status, notified_at, reservation_deadline, created_at,
      user:profiles!offline_waitlist_user_id_fkey(name, email),
      offline_sessions ( title, start_date, end_date,
        offline_programs ( title )
      )
    `)
    .in('status', ['waiting', 'notified'])
    .order('session_id')
    .order('created_at', { ascending: true })
    .limit(500)
  const rows = (rawRows as unknown as Row[] | null) ?? []

  // 회차별로 그룹핑 (순번 표시용)
  const grouped = new Map<string, Row[]>()
  for (const r of rows) {
    if (!grouped.has(r.session_id)) grouped.set(r.session_id, [])
    grouped.get(r.session_id)!.push(r)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">대기열 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          모든 회차의 대기 신청 통합 모니터링. 자리 발생 시 1순위에게 자동 알림.
          기한 미응답 시 다음 순위 자동 승격 (cron).
        </p>
      </div>

      {grouped.size === 0 ? (
        <EmptyState
          icon={Clock}
          title="활성 대기열이 없습니다"
          description="회차가 마감되면 사용자가 대기 신청할 수 있습니다. (waiting / notified 만 표시)"
        />
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(grouped.entries()).map(([sessionId, sessionRows]) => {
            const sess = sessionRows[0]?.offline_sessions
            const prog = sess?.offline_programs
            return (
              <section key={sessionId} className="rounded-2xl bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-navy">
                      {prog?.title ?? '-'}
                      {sess?.title && <span className="ml-1.5 text-sm font-normal text-gray-500">— {sess.title}</span>}
                    </p>
                    <p className="text-xs text-gray-500">
                      {sess && (
                        sess.start_date === sess.end_date
                          ? formatDate(sess.start_date)
                          : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`
                      )}
                      {' · '}대기 {sessionRows.length}명
                    </p>
                  </div>
                  <Link
                    href={`/admin/offline/programs/${sessionId}/sessions/${sessionId}`}
                    className="text-xs text-accent hover:underline"
                  >
                    회차 상세 →
                  </Link>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="px-2 py-2 text-left font-semibold">순번</th>
                        <th className="px-2 py-2 text-left font-semibold">사용자</th>
                        <th className="px-2 py-2 text-left font-semibold">인원</th>
                        <th className="px-2 py-2 text-left font-semibold">등록일</th>
                        <th className="px-2 py-2 text-left font-semibold">상태</th>
                        <th className="px-2 py-2 text-left font-semibold">알림 시각</th>
                        <th className="px-2 py-2 text-left font-semibold">결제 기한</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {sessionRows.map((r, i) => (
                        <tr key={r.id}>
                          <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                          <td className="px-2 py-2">
                            <p className="font-medium text-navy">{r.user?.name ?? '-'}</p>
                            <p className="text-[11px] text-gray-500">{r.user?.email ?? '-'}</p>
                          </td>
                          <td className="px-2 py-2 text-gray-600">{r.attendee_count}명</td>
                          <td className="px-2 py-2 text-gray-500">{formatDate(r.created_at)}</td>
                          <td className="px-2 py-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CLASS[r.status]}`}>
                              {STATUS_LABEL[r.status]}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-gray-500">
                            {r.notified_at ? new Date(r.notified_at).toLocaleString('ko-KR', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              timeZone: 'Asia/Seoul',
                            }) : '-'}
                          </td>
                          <td className="px-2 py-2 text-gray-500">
                            {r.reservation_deadline ? new Date(r.reservation_deadline).toLocaleString('ko-KR', {
                              month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                              timeZone: 'Asia/Seoul',
                            }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}
