import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Briefcase, Calendar, MapPin, ChevronRight, AlertCircle, CheckCircle2, XCircle, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '내 오프라인 신청' }
export const dynamic = 'force-dynamic'

type EnrollmentStatus = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded'

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending_payment: '결제 대기',
  confirmed: '자리 확정',
  expired: '기한 만료',
  cancelled: '취소됨',
  refunded: '환불 완료',
}

const STATUS_CLASS: Record<EnrollmentStatus, string> = {
  pending_payment: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-500',
  refunded: 'bg-blue-50 text-blue-700',
}

const STATUS_ICON: Record<EnrollmentStatus, React.ComponentType<{ className?: string }>> = {
  pending_payment: Clock,
  confirmed: CheckCircle2,
  expired: AlertCircle,
  cancelled: XCircle,
  refunded: XCircle,
}

interface EnrollmentRow {
  id: string
  status: EnrollmentStatus
  total_amount: number
  payment_due_at: string
  paid_at: string | null
  created_at: string
  offline_sessions: {
    id: string
    title: string | null
    start_date: string
    end_date: string
    location_name: string | null
    offline_programs: { title: string; slug: string } | null
  } | null
}

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'active', label: '진행 중' },     // pending_payment + confirmed
  { value: 'completed', label: '완료/취소' }, // expired + cancelled + refunded
] as const
type FilterValue = (typeof FILTERS)[number]['value']

export default async function MyOfflineListPage({
  searchParams,
}: {
  searchParams: { filter?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirectTo=/my/offline')

  const filter: FilterValue =
    (FILTERS.find((f) => f.value === searchParams.filter)?.value ?? 'all')

  let query = supabase
    .from('offline_enrollments')
    .select(`
      id, status, total_amount, payment_due_at, paid_at, created_at,
      offline_sessions ( id, title, start_date, end_date, location_name,
        offline_programs ( title, slug )
      )
    `)
    .eq('applicant_user_id', user.id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (filter === 'active') {
    query = query.in('status', ['pending_payment', 'confirmed'])
  } else if (filter === 'completed') {
    query = query.in('status', ['expired', 'cancelled', 'refunded'])
  }

  const { data: rawRows } = await query
  const rows = (rawRows as unknown as EnrollmentRow[] | null) ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy">내 오프라인 신청</h1>
        <p className="mt-1 text-sm text-gray-500">
          신청한 워크샵 · 정규 과정 · 기업 맞춤 교육 내역
        </p>
      </header>

      <div className="mb-6 inline-flex rounded-xl border border-gray-200 bg-white p-1 text-sm">
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <Link
              key={f.value}
              href={`/my/offline${f.value === 'all' ? '' : `?filter=${f.value}`}`}
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
          icon={Briefcase}
          title="신청 내역이 없습니다"
          description="오프라인 교육 프로그램을 둘러보세요."
        />
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map((e) => {
            const prog = e.offline_sessions?.offline_programs
            const sess = e.offline_sessions
            const StatusIcon = STATUS_ICON[e.status]
            const sameDay = sess && sess.start_date === sess.end_date
            return (
              <Link
                key={e.id}
                href={`/my/offline/${e.id}`}
                className="group flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:border-accent/40 hover:shadow-md md:flex-row md:items-center md:justify-between"
              >
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[e.status]}`}>
                      <StatusIcon className="h-3 w-3" />
                      {STATUS_LABEL[e.status]}
                    </span>
                  </div>
                  <p className="font-semibold text-navy group-hover:text-accent">
                    {prog?.title ?? '(프로그램 정보 없음)'}
                    {sess?.title && <span className="ml-1.5 text-sm font-normal text-gray-500">— {sess.title}</span>}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
                    {sess && (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        {sameDay
                          ? formatDate(sess.start_date)
                          : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`}
                      </span>
                    )}
                    {sess?.location_name && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {sess.location_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 md:flex-col md:items-end">
                  <span className="text-base font-bold text-navy">
                    {e.total_amount.toLocaleString()}원
                  </span>
                  <ChevronRight className="h-4 w-4 text-gray-300 transition group-hover:text-accent" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
