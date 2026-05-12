import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Calendar, MapPin, Users, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  OFFLINE_SESSION_STATUS_LABEL,
  type OfflineSessionStatus,
} from '@/types/database'
import dayjs from '@/lib/dayjs'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '회차 일정' }

const STATUS_CLASS: Record<OfflineSessionStatus, string> = {
  open: 'bg-green-100 text-green-700',
  closed: 'bg-amber-50 text-amber-700',
  cancelled: 'bg-red-50 text-red-600',
  completed: 'bg-gray-100 text-gray-600',
}

const FILTERS = [
  { value: 'upcoming', label: '진행 예정' },
  { value: 'past',     label: '지난 회차' },
  { value: 'all',      label: '전체' },
] as const
type FilterValue = (typeof FILTERS)[number]['value']

interface SessionRow {
  id: string
  program_id: string
  title: string | null
  start_date: string
  end_date: string
  capacity: number
  price: number
  location_name: string | null
  status: OfflineSessionStatus
  offline_programs: { id: string; title: string; slug: string } | null
}

export default async function AdminOfflineSessionsSchedulePage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const filter: FilterValue =
    (FILTERS.find((f) => f.value === searchParams.filter)?.value ?? 'upcoming')

  const today = dayjs().format('YYYY-MM-DD')

  let query = supabase
    .from('offline_sessions')
    .select(`
      id, program_id, title, start_date, end_date, capacity, price,
      location_name, status,
      offline_programs!inner ( id, title, slug )
    `)
    .is('deleted_at', null)

  if (filter === 'upcoming') {
    query = query.gte('end_date', today).order('start_date', { ascending: true })
  } else if (filter === 'past') {
    query = query.lt('end_date', today).order('start_date', { ascending: false })
  } else {
    query = query.order('start_date', { ascending: false })
  }

  const { data: rawRows } = await query.limit(200)
  const rows = (rawRows as unknown as SessionRow[] | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">회차 일정</h1>
        <p className="mt-1 text-sm text-gray-500">
          모든 오프라인 프로그램의 개설 회차를 한 화면에서 관리.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm">
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <Link
              key={f.value}
              href={`/admin/offline/sessions?filter=${f.value}`}
              className={`rounded-lg px-4 py-1.5 transition-colors ${
                active ? 'bg-navy text-white' : 'text-gray-600 hover:bg-silver'
              }`}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title={filter === 'past' ? '지난 회차가 없습니다' : '예정된 회차가 없습니다'}
          description="프로그램에서 회차를 추가해보세요."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-silver">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">프로그램</th>
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
              {rows.map((s) => {
                const sameDay = s.start_date === s.end_date
                const prog = s.offline_programs
                return (
                  <tr key={s.id} className="border-b border-gray-50 hover:bg-silver/50">
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/offline/programs/${s.program_id}/edit`}
                        className="font-medium text-navy hover:text-accent"
                      >
                        {prog?.title ?? '(삭제됨)'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{s.title || '-'}</td>
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
                        href={`/admin/offline/programs/${s.program_id}/sessions/${s.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        편집 <ChevronRight className="h-3 w-3" />
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
