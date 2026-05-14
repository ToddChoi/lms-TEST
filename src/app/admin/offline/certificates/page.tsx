import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Award } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { EmptyState } from '@/components/ui/EmptyState'
import { IssueCertificatesForm } from '@/components/admin/offline/IssueCertificatesForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 수료증' }
export const dynamic = 'force-dynamic'

interface CertRow {
  id: string
  certificate_number: string
  attendance_rate: number
  issued_at: string
  user_id: string | null
  attendee_id: string | null
  pdf_url: string | null
  user: { name: string | null; email: string | null } | null
  attendee: { name: string; email: string | null } | null
  offline_sessions: {
    title: string | null
    offline_programs: { title: string } | null
  } | null
}

interface SessionOption {
  id: string
  label: string
}

export default async function AdminOfflineCertificatesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // 발급 내역 (최근 100건)
  const { data: rawCerts } = await supabase
    .from('offline_certificates')
    .select(`
      id, certificate_number, attendance_rate, issued_at,
      user_id, attendee_id, pdf_url,
      user:profiles!offline_certificates_user_id_fkey ( name, email ),
      attendee:offline_attendees!offline_certificates_attendee_id_fkey ( name, email ),
      offline_sessions ( title, offline_programs ( title ) )
    `)
    .order('issued_at', { ascending: false })
    .limit(100)
  const certs = (rawCerts as unknown as CertRow[] | null) ?? []

  // 발급 가능 회차 (start_date ≤ today — 종료된 회차)
  const today = new Date().toISOString().slice(0, 10)
  const { data: rawSessions } = await supabase
    .from('offline_sessions')
    .select('id, title, start_date, end_date, offline_programs(title)')
    .lte('end_date', today)
    .is('deleted_at', null)
    .order('end_date', { ascending: false })
    .limit(50)
  const sessionOptions = ((rawSessions as unknown as Array<{
    id: string
    title: string | null
    start_date: string
    end_date: string
    offline_programs: { title: string } | null
  }>) ?? []).map<SessionOption>((s) => ({
    id: s.id,
    label: `${s.offline_programs?.title ?? '-'}${s.title ? ` — ${s.title}` : ''} (${formatDate(s.end_date)})`,
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">오프라인 수료증</h1>
        <p className="mt-1 text-sm text-gray-500">
          종료된 회차의 수료 가능자에게 일괄 발급. 출석률 기준은 프로그램별
          completion_attendance_rate 설정 값 (default 80%).
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">일괄 발급</h2>
        <IssueCertificatesForm sessions={sessionOptions} />
      </section>

      <div>
        <h2 className="mb-3 text-sm font-bold text-navy">발급 내역</h2>
        {certs.length === 0 ? (
          <EmptyState
            icon={Award}
            title="발급된 수료증이 없습니다"
            description="회차 종료 후 위에서 일괄 발급하세요."
          />
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-silver">
                  <th className="px-3 py-3 text-left font-semibold text-gray-600">수료자</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600">프로그램 / 회차</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600">수료번호</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600">출석률</th>
                  <th className="px-3 py-3 text-left font-semibold text-gray-600">발급일</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-600">PDF</th>
                </tr>
              </thead>
              <tbody>
                {certs.map((c) => {
                  const sess = c.offline_sessions
                  const prog = sess?.offline_programs
                  const recipientName = c.user?.name ?? c.attendee?.name ?? '-'
                  const recipientEmail = c.user?.email ?? c.attendee?.email ?? null
                  return (
                    <tr key={c.id} className="border-b border-gray-50 hover:bg-silver/50">
                      <td className="px-3 py-3">
                        <p className="font-medium text-navy">{recipientName}</p>
                        {recipientEmail && <p className="text-[11px] text-gray-500">{recipientEmail}</p>}
                      </td>
                      <td className="px-3 py-3 text-gray-700">
                        {prog?.title ?? '-'}
                        {sess?.title && <span className="ml-1 text-xs text-gray-500">{sess.title}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <code className="text-[11px] font-mono">{c.certificate_number}</code>
                      </td>
                      <td className="px-3 py-3 text-gray-700">{c.attendance_rate}%</td>
                      <td className="px-3 py-3 text-gray-500 text-xs">{formatDate(c.issued_at)}</td>
                      <td className="px-3 py-3 text-right">
                        {c.pdf_url ? (
                          <Link
                            href={`/api/offline/certificates/${c.id}/download`}
                            target="_blank"
                            className="inline-block rounded-lg bg-accent-pale px-3 py-1 text-xs font-medium text-accent hover:bg-accent hover:text-white"
                          >
                            PDF
                          </Link>
                        ) : (
                          <span className="text-xs text-gray-400">미생성</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
