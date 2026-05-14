import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ChevronLeft, Calendar, MapPin, Building2, Users, Receipt, AlertCircle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { ConfirmInvoicePaymentButton } from '@/components/admin/offline/ConfirmInvoicePaymentButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '신청 상세' }
export const dynamic = 'force-dynamic'

type EnrollmentStatus = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded'

interface EnrollmentRow {
  id: string
  status: EnrollmentStatus
  applicant_user_id: string
  applicant_type: 'individual' | 'corporate'
  attendee_count: number
  payment_method: 'card' | 'invoice' | null
  unit_price: number
  total_amount: number
  vat_included: boolean
  payment_due_at: string
  paid_at: string | null
  cancelled_at: string | null
  refunded_at: string | null
  refund_amount: number | null
  refund_rate: number | null
  notes: string | null
  company_id: string | null
  company_contact_name: string | null
  company_contact_email: string | null
  company_contact_phone: string | null
  invoice_paid_confirmed_at: string | null
  stripe_session_id: string | null
  stripe_payment_intent_id: string | null
  applicant: { name: string | null; email: string | null } | null
  offline_sessions: {
    id: string
    title: string | null
    start_date: string
    end_date: string
    location_name: string | null
    location_address: string | null
    program_id: string
    offline_programs: { id: string; title: string; slug: string } | null
  } | null
}

interface AttendeeRow {
  id: string
  name: string
  email: string | null
  phone: string | null
  department: string | null
  position: string | null
  cancelled_at: string | null
}

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending_payment: '결제 대기', confirmed: '결제 완료', expired: '기한 만료',
  cancelled: '취소', refunded: '환불',
}

export default async function AdminEnrollmentDetailPage({
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

  const { data: rawEnrollment } = await supabase
    .from('offline_enrollments')
    .select(`
      id, status, applicant_user_id, applicant_type, attendee_count,
      payment_method, unit_price, total_amount, vat_included,
      payment_due_at, paid_at, cancelled_at, refunded_at,
      refund_amount, refund_rate, notes,
      company_id, company_contact_name, company_contact_email, company_contact_phone,
      invoice_paid_confirmed_at, stripe_session_id, stripe_payment_intent_id,
      applicant:profiles!offline_enrollments_applicant_user_id_fkey(name, email),
      offline_sessions (
        id, title, start_date, end_date, location_name, location_address,
        program_id, offline_programs ( id, title, slug )
      )
    `)
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()
  const enrollment = rawEnrollment as unknown as EnrollmentRow | null
  if (!enrollment) notFound()

  // 단체면 회사 + 참석자 (admin client)
  let companyName: string | null = null
  let attendees: AttendeeRow[] = []
  if (enrollment.applicant_type === 'corporate' && enrollment.company_id) {
    const admin = createAdminClient()
    const { data: rawCompany } = await (admin as any)
      .from('companies').select('name').eq('id', enrollment.company_id).maybeSingle()
    companyName = (rawCompany as unknown as { name: string } | null)?.name ?? null

    const { data: rawAttendees } = await (admin as any)
      .from('offline_attendees')
      .select('id, name, email, phone, department, position, cancelled_at')
      .eq('enrollment_id', enrollment.id)
      .order('created_at', { ascending: true })
    attendees = (rawAttendees as unknown as AttendeeRow[] | null) ?? []
  }

  const sess = enrollment.offline_sessions
  const prog = sess?.offline_programs
  const sameDay = sess && sess.start_date === sess.end_date
  const canConfirmInvoice =
    enrollment.payment_method === 'invoice' && enrollment.status === 'pending_payment'

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/offline/enrollments"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
        >
          <ChevronLeft className="h-4 w-4" /> 신청·결제 현황
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">신청 상세</h1>
      </div>

      {/* 상태 + 핵심 액션 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-block rounded-full bg-silver px-3 py-1 text-xs font-medium text-gray-700">
              {STATUS_LABEL[enrollment.status]}
            </span>
            <p className="mt-2 text-base font-semibold text-navy">
              {prog?.title ?? '-'}
              {sess?.title && <span className="ml-2 text-sm font-normal text-gray-500">— {sess.title}</span>}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              신청자: {enrollment.applicant?.name ?? '-'} ({enrollment.applicant?.email ?? '-'}) ·
              유형: {enrollment.applicant_type === 'corporate' ? '단체' : '개인'} ·
              인원: {enrollment.attendee_count}명
            </p>
          </div>
          {canConfirmInvoice && (
            <ConfirmInvoicePaymentButton
              enrollmentId={enrollment.id}
              amount={enrollment.total_amount}
            />
          )}
        </div>
      </section>

      {/* 강좌 일정 */}
      {sess && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-navy">강좌 일정</h2>
          <div className="flex flex-col gap-2 text-sm text-gray-700">
            <div className="flex items-start gap-2">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                {sameDay
                  ? formatDate(sess.start_date)
                  : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`}
              </span>
            </div>
            {sess.location_name && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div>
                  <p>{sess.location_name}</p>
                  {sess.location_address && (
                    <p className="text-xs text-gray-500">{sess.location_address}</p>
                  )}
                </div>
              </div>
            )}
          </div>
          <Link
            href={`/admin/offline/programs/${sess.program_id}/sessions/${sess.id}`}
            className="mt-3 inline-block text-xs text-accent hover:underline"
          >
            회차 편집 페이지 →
          </Link>
        </section>
      )}

      {/* 단체 정보 */}
      {enrollment.applicant_type === 'corporate' && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-navy">
            <Building2 className="h-4 w-4 text-accent" /> 단체 정보
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            {companyName && <Row label="회사" value={companyName} />}
            {enrollment.company_contact_name && (
              <Row
                label="담당자"
                value={
                  <>
                    {enrollment.company_contact_name}
                    {enrollment.company_contact_email && (
                      <span className="ml-1 text-xs text-gray-500">
                        ({enrollment.company_contact_email})
                      </span>
                    )}
                  </>
                }
              />
            )}
            {enrollment.company_contact_phone && (
              <Row label="연락처" value={enrollment.company_contact_phone} />
            )}
          </dl>
        </section>
      )}

      {/* 참석자 명단 */}
      {enrollment.applicant_type === 'corporate' && attendees.length > 0 && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-navy">
            <Users className="h-4 w-4 text-accent" /> 참석자 명단 ({attendees.filter((a) => !a.cancelled_at).length}명)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-2 py-2 text-left font-semibold">#</th>
                  <th className="px-2 py-2 text-left font-semibold">이름</th>
                  <th className="px-2 py-2 text-left font-semibold">이메일</th>
                  <th className="px-2 py-2 text-left font-semibold">전화</th>
                  <th className="px-2 py-2 text-left font-semibold">부서</th>
                  <th className="px-2 py-2 text-left font-semibold">직책</th>
                  <th className="px-2 py-2 text-left font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendees.map((a, i) => (
                  <tr key={a.id} className={a.cancelled_at ? 'opacity-50' : ''}>
                    <td className="px-2 py-2 text-gray-500">{i + 1}</td>
                    <td className="px-2 py-2 font-medium text-navy">{a.name}</td>
                    <td className="px-2 py-2 text-gray-600">{a.email ?? '-'}</td>
                    <td className="px-2 py-2 text-gray-600">{a.phone ?? '-'}</td>
                    <td className="px-2 py-2 text-gray-600">{a.department ?? '-'}</td>
                    <td className="px-2 py-2 text-gray-600">{a.position ?? '-'}</td>
                    <td className="px-2 py-2">
                      {a.cancelled_at ? (
                        <span className="text-red-500">취소</span>
                      ) : (
                        <span className="text-green-600">참석</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 결제 정보 */}
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-navy">
          <Receipt className="h-4 w-4 text-accent" /> 결제 정보
        </h2>
        <dl className="flex flex-col gap-2 text-sm">
          <Row
            label="방식"
            value={enrollment.payment_method === 'card' ? '카드 결제' :
              enrollment.payment_method === 'invoice' ? '세금계산서' : '미지정'}
          />
          <Row
            label="단가 / 인원"
            value={`${enrollment.unit_price.toLocaleString()}원 × ${enrollment.attendee_count}명`}
          />
          <Row
            label="총 금액"
            value={
              <span className="font-bold text-navy">
                {enrollment.total_amount.toLocaleString()}원
                {!enrollment.vat_included && (
                  <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
                )}
              </span>
            }
          />
          <Row
            label="결제 기한"
            value={new Date(enrollment.payment_due_at).toLocaleString('ko-KR', {
              year: 'numeric', month: 'long', day: 'numeric',
              hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
            })}
          />
          {enrollment.paid_at && (
            <Row
              label="결제 완료"
              value={new Date(enrollment.paid_at).toLocaleString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
              })}
            />
          )}
          {enrollment.invoice_paid_confirmed_at && (
            <Row
              label="입금 확인"
              value={new Date(enrollment.invoice_paid_confirmed_at).toLocaleString('ko-KR', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
              })}
            />
          )}
          {enrollment.stripe_session_id && (
            <Row
              label="Stripe Session"
              value={<code className="text-[11px] font-mono">{enrollment.stripe_session_id}</code>}
            />
          )}
          {enrollment.stripe_payment_intent_id && (
            <Row
              label="Stripe PI"
              value={<code className="text-[11px] font-mono">{enrollment.stripe_payment_intent_id}</code>}
            />
          )}
          {enrollment.refunded_at && (
            <Row
              label="환불"
              value={
                <span className="text-blue-600">
                  {enrollment.refund_amount?.toLocaleString()}원 환불
                  {enrollment.refund_rate != null && ` (${enrollment.refund_rate}%)`}
                </span>
              }
            />
          )}
        </dl>
      </section>

      {enrollment.notes && (
        <section className="rounded-xl bg-amber-50 p-4">
          <p className="flex items-start gap-2 text-xs text-amber-700">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span><strong>메모:</strong> {enrollment.notes}</span>
          </p>
        </section>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-24 shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="flex-1 text-sm text-gray-700">{value}</dd>
    </div>
  )
}
