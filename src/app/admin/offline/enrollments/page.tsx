import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ClipboardCheck, ChevronRight, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 신청·결제 현황' }
export const dynamic = 'force-dynamic'

type EnrollmentStatus = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded'

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending_payment: '결제 대기',
  confirmed: '결제 완료',
  expired: '기한 만료',
  cancelled: '취소',
  refunded: '환불',
}
const STATUS_CLASS: Record<EnrollmentStatus, string> = {
  pending_payment: 'bg-amber-50 text-amber-700',
  confirmed: 'bg-green-100 text-green-700',
  expired: 'bg-gray-100 text-gray-500',
  cancelled: 'bg-gray-100 text-gray-500',
  refunded: 'bg-blue-50 text-blue-700',
}

const FILTERS = [
  { value: 'all', label: '전체' },
  { value: 'pending_payment', label: '결제 대기' },
  { value: 'confirmed', label: '결제 완료' },
  { value: 'expired', label: '만료' },
  { value: 'cancelled', label: '취소' },
  { value: 'refunded', label: '환불' },
] as const
type FilterValue = (typeof FILTERS)[number]['value']

interface Row {
  id: string
  status: EnrollmentStatus
  applicant_type: 'individual' | 'corporate'
  attendee_count: number
  payment_method: 'card' | 'invoice' | null
  total_amount: number
  payment_due_at: string
  created_at: string
  applicant: { name: string | null; email: string | null } | null
  offline_sessions: {
    title: string | null
    start_date: string
    end_date: string
    offline_programs: { title: string } | null
  } | null
}

export default async function AdminOfflineEnrollmentsPage({
  searchParams,
}: {
  searchParams: { filter?: string; session_id?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const filter: FilterValue =
    (FILTERS.find((f) => f.value === searchParams.filter)?.value ?? 'all')
  const sessionFilter = searchParams.session_id ?? ''

  let query = supabase
    .from('offline_enrollments')
    .select(`
      id, status, applicant_type, attendee_count, payment_method,
      total_amount, payment_due_at, created_at,
      applicant:profiles!offline_enrollments_applicant_user_id_fkey(name, email),
      offline_sessions ( title, start_date, end_date,
        offline_programs ( title )
      )
    `)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200)
  if (filter !== 'all') query = query.eq('status', filter)
  if (sessionFilter) query = query.eq('session_id', sessionFilter)

  const { data: rawRows } = await query
  const rows = (rawRows as unknown as Row[] | null) ?? []

  // 상태별 카운트 (전체 기준 — 필터 무관)
  const { data: rawCounts } = await (supabase as any)
    .from('offline_enrollments')
    .select('status')
    .is('deleted_at', null)
  const allRows = (rawCounts as unknown as Array<{ status: EnrollmentStatus }> | null) ?? []
  const counts: Record<EnrollmentStatus, number> = {
    pending_payment: 0, confirmed: 0, expired: 0, cancelled: 0, refunded: 0,
  }
  for (const r of allRows) counts[r.status]++

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">오프라인 신청·결제 현황</h1>
        <p className="mt-1 text-sm text-gray-500">
          모든 회차의 신청 통합 관리. 세금계산서 입금 확인 / 신청 상세 처리.
        </p>
      </div>

      {/* 상태별 요약 카드 */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <SummaryCard
          label="결제 대기"
          count={counts.pending_payment}
          icon={Clock}
          accent="bg-amber-50 text-amber-700"
        />
        <SummaryCard
          label="결제 완료"
          count={counts.confirmed}
          icon={CheckCircle2}
          accent="bg-green-100 text-green-700"
        />
        <SummaryCard label="만료" count={counts.expired} icon={AlertCircle} accent="bg-gray-100 text-gray-600" />
        <SummaryCard label="취소" count={counts.cancelled} icon={XCircle} accent="bg-gray-100 text-gray-600" />
        <SummaryCard label="환불" count={counts.refunded} icon={XCircle} accent="bg-blue-50 text-blue-700" />
      </div>

      <div className="inline-flex flex-wrap rounded-xl border border-gray-200 bg-white p-1 text-sm">
        {FILTERS.map((f) => {
          const active = filter === f.value
          return (
            <Link
              key={f.value}
              href={`/admin/offline/enrollments${f.value === 'all' ? '' : `?filter=${f.value}`}`}
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
          icon={ClipboardCheck}
          title="조건에 맞는 신청이 없습니다"
          description="필터를 조정하거나 신청이 들어오면 자동으로 표시됩니다."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-silver">
                <th className="px-3 py-3 text-left font-semibold text-gray-600">신청자</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">유형</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">프로그램 / 회차</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">인원</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">금액</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">결제</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">상태</th>
                <th className="px-3 py-3 text-left font-semibold text-gray-600">신청일</th>
                <th className="px-3 py-3 text-right font-semibold text-gray-600">상세</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const sess = r.offline_sessions
                const prog = sess?.offline_programs
                return (
                  <tr key={r.id} className="border-b border-gray-50 hover:bg-silver/50">
                    <td className="px-3 py-3">
                      <p className="font-medium text-navy">{r.applicant?.name ?? '-'}</p>
                      <p className="text-xs text-gray-500">{r.applicant?.email ?? '-'}</p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {r.applicant_type === 'corporate' ? '단체' : '개인'}
                    </td>
                    <td className="px-3 py-3 text-gray-700">
                      {prog?.title ?? '-'}
                      {sess?.title && <span className="ml-1 text-xs text-gray-500">{sess.title}</span>}
                      <p className="text-xs text-gray-400">
                        {sess && (
                          sess.start_date === sess.end_date
                            ? formatDate(sess.start_date)
                            : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-gray-600">{r.attendee_count}명</td>
                    <td className="px-3 py-3 font-medium text-navy">
                      {r.total_amount.toLocaleString()}원
                    </td>
                    <td className="px-3 py-3 text-gray-600">
                      {r.payment_method === 'card' ? '카드' :
                        r.payment_method === 'invoice' ? '세금계산서' : '-'}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-500 text-xs">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link
                        href={`/admin/offline/enrollments/${r.id}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        상세 <ChevronRight className="h-3 w-3" />
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

function SummaryCard({
  label, count, icon: Icon, accent,
}: {
  label: string
  count: number
  icon: React.ComponentType<{ className?: string }>
  accent: string
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-gray-500">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-navy">{count}</p>
    </div>
  )
}
