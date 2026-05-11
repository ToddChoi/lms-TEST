import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, Plus, Pencil, Calendar, MapPin, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  OFFLINE_SESSION_STATUS_LABEL,
  type OfflineSession,
  type OfflineSessionStatus,
} from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '회차 관리' }

const STATUS_CLASS: Record<OfflineSessionStatus, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-600',
  completed: 'bg-gray-100 text-gray-600',
}

export default async function ProgramSessionsPage({
  params,
}: {
  params: { id: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // 프로그램 사전 로드
  const { data: rawProgram } = await supabase
    .from('offline_programs')
    .select('id, title, slug')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()
  const program = rawProgram as unknown as { id: string; title: string; slug: string } | null
  if (!program) notFound()

  // 회차 목록 (최신순)
  const { data: rawSessions } = await supabase
    .from('offline_sessions')
    .select('id, title, start_date, end_date, capacity, price, location_name, status, created_at')
    .eq('program_id', program.id)
    .is('deleted_at', null)
    .order('start_date', { ascending: false })
  const sessions = (rawSessions as unknown as Array<
    Pick<OfflineSession,
      'id' | 'title' | 'start_date' | 'end_date' | 'capacity' |
      'price' | 'location_name' | 'status' | 'created_at'>
  > | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/offline/programs/${program.id}/edit`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> {program.title}
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-navy">회차 관리</h1>
            <p className="mt-1 text-sm text-gray-500">총 {sessions.length}개</p>
          </div>
          <Link
            href={`/admin/offline/programs/${program.id}/sessions/new`}
            className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
          >
            <Plus className="h-4 w-4" /> 회차 추가
          </Link>
        </div>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="등록된 회차가 없습니다"
          description="이 프로그램의 첫 개설 회차를 추가해보세요."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-silver">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">회차</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">기간</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">장소</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">정원</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">가격</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">상태</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">관리</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => {
                const sameDay = s.start_date === s.end_date
                return (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-silver/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 shrink-0 text-gray-300" />
                        <span className="font-medium text-navy">{s.title || '(이름 없음)'}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {sameDay
                        ? formatDate(s.start_date)
                        : `${formatDate(s.start_date)} ~ ${formatDate(s.end_date)}`}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {s.location_name ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-gray-400" />
                          {s.location_name}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      <span className="inline-flex items-center gap-1">
                        <Users className="h-3.5 w-3.5 text-gray-400" />
                        {s.capacity}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-navy">
                      {s.price === 0 ? '무료' : `${s.price.toLocaleString()}원`}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[s.status]}`}>
                        {OFFLINE_SESSION_STATUS_LABEL[s.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/offline/programs/${program.id}/sessions/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        <Pencil className="h-3 w-3" /> 편집
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
