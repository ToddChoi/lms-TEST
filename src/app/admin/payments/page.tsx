import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'

const PAGE_SIZE = 20

const STATUS_LABELS: Record<string, string> = {
  pending: '대기',
  succeeded: '결제완료',
  failed: '실패',
  refunded: '환불',
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-700',
    succeeded: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-500',
    refunded: 'bg-gray-100 text-gray-500',
  }
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
        map[status] ?? 'bg-gray-100 text-gray-500'
      }`}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  )
}

type PaymentRow = {
  id: string
  amount: number
  currency: string
  status: string
  receipt_url: string | null
  stripe_session_id: string | null
  created_at: string
  profiles: { name: string | null; email: string | null } | null
  courses: { title: string | null } | null
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string }
}) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const statusFilter = searchParams.status ?? ''
  const q = searchParams.q ?? ''
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('payments')
    .select(
      'id, amount, currency, status, receipt_url, stripe_session_id, created_at, profiles(name, email), courses(title)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)

  if (statusFilter) {
    query = query.eq('status', statusFilter)
  }

  const { data: rawPayments, count } = await query
  const payments = (rawPayments as unknown as PaymentRow[] | null) ?? []

  // Client-side q filter (name/email/course title)
  const filtered = q
    ? payments.filter(
        (p) =>
          p.profiles?.email?.toLowerCase().includes(q.toLowerCase()) ||
          p.profiles?.name?.toLowerCase().includes(q.toLowerCase()) ||
          p.courses?.title?.toLowerCase().includes(q.toLowerCase())
      )
    : payments

  const totalPages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE))

  // 상태별 합계 (현재 페이지 기준이 아닌, 전체 카운트 고정 — 페이지 총합만 표시)
  const succeededAmount = filtered
    .filter((p) => p.status === 'succeeded')
    .reduce((acc, p) => acc + p.amount, 0)

  function pageUrl(p: number) {
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (statusFilter) params.set('status', statusFilter)
    params.set('page', String(p))
    return `/admin/payments?${params.toString()}`
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">결제 내역</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-500">총 {count ?? 0}건</span>
          <span className="text-[#0B1F3A]">
            현재 페이지 결제완료 합계:{' '}
            <span className="font-semibold">
              ₩{succeededAmount.toLocaleString()}
            </span>
          </span>
        </div>
      </div>

      {/* Filters */}
      <form method="GET" className="flex gap-3 flex-wrap mb-5">
        <input
          name="q"
          defaultValue={q}
          placeholder="이메일 / 이름 / 강좌명 검색"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        />
        <select
          name="status"
          defaultValue={statusFilter}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        >
          <option value="">전체 상태</option>
          <option value="pending">대기</option>
          <option value="succeeded">결제완료</option>
          <option value="failed">실패</option>
          <option value="refunded">환불</option>
        </select>
        <button
          type="submit"
          className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition"
        >
          검색
        </button>
        <Link
          href="/admin/payments"
          className="border border-gray-300 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          초기화
        </Link>
      </form>

      <div className="overflow-x-auto bg-white rounded-xl shadow-sm border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-[#F4F6FA] text-[#0B1F3A]">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">결제일</th>
              <th className="px-4 py-3 text-left font-semibold">이름</th>
              <th className="px-4 py-3 text-left font-semibold">이메일</th>
              <th className="px-4 py-3 text-left font-semibold">강좌</th>
              <th className="px-4 py-3 text-right font-semibold">금액</th>
              <th className="px-4 py-3 text-left font-semibold">상태</th>
              <th className="px-4 py-3 text-left font-semibold">영수증</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  결제 내역이 없습니다.
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-[#E8F2FC]/30 transition">
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(p.created_at)}
                  </td>
                  <td className="px-4 py-3 font-medium text-[#0B1F3A]">
                    {p.profiles?.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.profiles?.email ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {p.courses?.title ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-right text-[#0B1F3A] font-semibold">
                    ₩{p.amount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3">
                    {p.receipt_url ? (
                      <a
                        href={p.receipt_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#2D7DD2] hover:underline"
                      >
                        보기
                      </a>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-1 mt-6">
          {page > 1 && (
            <Link
              href={pageUrl(page - 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              이전
            </Link>
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2)
            .map((p) => (
              <Link
                key={p}
                href={pageUrl(p)}
                className={`px-3 py-1.5 rounded-lg border text-sm transition ${
                  p === page
                    ? 'bg-[#2D7DD2] text-white border-[#2D7DD2]'
                    : 'border-gray-300 hover:bg-gray-50'
                }`}
              >
                {p}
              </Link>
            ))}
          {page < totalPages && (
            <Link
              href={pageUrl(page + 1)}
              className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm hover:bg-gray-50"
            >
              다음
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
