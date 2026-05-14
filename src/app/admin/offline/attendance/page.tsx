import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckSquare, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '출결 관리' }
export const dynamic = 'force-dynamic'

interface DayRow {
  id: string
  session_id: string
  day_number: number
  date: string
  start_time: string
  end_time: string
  topic: string | null
  offline_sessions: {
    title: string | null
    offline_programs: { title: string } | null
  } | null
}

export default async function AdminOfflineAttendanceListPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // 최근 + 곧 진행될 일자 (오늘 ± 30일)
  const today = new Date().toISOString().slice(0, 10)
  const before = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  const after = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const { data: rawRows } = await supabase
    .from('offline_session_days')
    .select(`
      id, session_id, day_number, date, start_time, end_time, topic,
      offline_sessions ( title, offline_programs ( title ) )
    `)
    .gte('date', before)
    .lte('date', after)
    .order('date', { ascending: false })
    .limit(100)
  const rows = (rawRows as unknown as DayRow[] | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">출결 관리</h1>
        <p className="mt-1 text-sm text-gray-500">
          최근 30일 / 다가오는 30일 회차 일자. 일자를 선택해 출석부 확인 및 수동 보정.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="해당 기간에 회차 일자가 없습니다"
          description="프로그램 > 회차 편집 페이지에서 회차 일자를 등록해주세요."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-silver">
                <th className="px-3 py-3 text-left font-semibold text-gray-600">일자</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">프로그램 / 회차</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">일차</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">시간</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">주제</th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600">출석부</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((d) => {
                const sess = d.offline_sessions
                const prog = sess?.offline_programs
                const isToday = d.date === today
                const isPast = d.date < today
                return (
                  <tr key={d.id} className={`border-b border-gray-50 hover:bg-silver/50 ${isToday ? 'bg-accent-pale/30' : ''}`}>
                    <td className="px-3 py-3 font-medium">
                      <span className={isPast ? 'text-gray-500' : 'text-navy'}>{formatDate(d.date)}</span>
                      {isToday && <span className="ml-2 inline-block rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">오늘</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {prog?.title ?? '-'}
                      {sess?.title && <span className="ml-1 text-xs text-gray-500">{sess.title}</span>}
                    </td>
                    <td className="px-3 py-3 text-gray-600">{d.day_number}일차</td>
                    <td className="px-3 py-3 text-gray-600 text-xs">
                      {d.start_time.slice(0, 5)} ~ {d.end_time.slice(0, 5)}
                    </td>
                    <td className="px-3 py-3 text-gray-600 text-xs">{d.topic ?? '-'}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/offline/attendance/${d.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        출석부 <ChevronRight className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
