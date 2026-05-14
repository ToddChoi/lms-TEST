import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  ChevronLeft, Calendar, MapPin, Clock, CheckCircle2, AlertCircle,
  XCircle, ExternalLink, QrCode, Building2, Users, Award,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { calculateRefund, type RefundPolicy } from '@/lib/offline/refund-policy'
import { OfflineCancelButton } from '@/components/offline/OfflineCancelButton'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '신청 상세' }
export const dynamic = 'force-dynamic'

type EnrollmentStatus = 'pending_payment' | 'confirmed' | 'expired' | 'cancelled' | 'refunded'

const STATUS_LABEL: Record<EnrollmentStatus, string> = {
  pending_payment: '결제 대기',
  confirmed: '자리 확정',
  expired: '기한 만료',
  cancelled: '취소됨',
  refunded: '환불 완료',
}

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
  created_at: string
  notes: string | null
  // corporate 필드
  company_id: string | null
  company_contact_name: string | null
  company_contact_email: string | null
  company_contact_phone: string | null
  invoice_paid_confirmed_at: string | null
  refund_policy_snapshot: RefundPolicy
  offline_sessions: {
    id: string
    title: string | null
    start_date: string
    end_date: string
    capacity: number
    location_name: string | null
    location_address: string | null
    location_url: string | null
    offline_programs: { id: string; title: string; slug: string; instructor_name: string | null } | null
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
  user_id: string | null
}

export default async function MyOfflineDetailPage({
  params,
}: {
  params: { enrollmentId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect(`/login?redirectTo=/my/offline/${params.enrollmentId}`)

  // RLS 정책 (enrollments_owner_read) 가 본인 enrollment 만 노출. 추가 가드 안전망.
  const { data: rawEnrollment } = await supabase
    .from('offline_enrollments')
    .select(`
      id, status, applicant_user_id, applicant_type, attendee_count,
      payment_method, unit_price, total_amount, vat_included,
      payment_due_at, paid_at, cancelled_at, refunded_at,
      refund_amount, refund_rate, created_at, notes,
      company_id, company_contact_name, company_contact_email,
      company_contact_phone, invoice_paid_confirmed_at, refund_policy_snapshot,
      offline_sessions (
        id, title, start_date, end_date, capacity,
        location_name, location_address, location_url,
        offline_programs ( id, title, slug, instructor_name )
      )
    `)
    .eq('id', params.enrollmentId)
    .is('deleted_at', null)
    .maybeSingle()
  const enrollment = rawEnrollment as unknown as EnrollmentRow | null
  if (!enrollment || enrollment.applicant_user_id !== user.id) notFound()

  // 단체 신청이면 회사 정보 + 참석자 명단 fetch (admin client — companies/attendees RLS)
  let companyName: string | null = null
  let attendees: AttendeeRow[] = []
  const admin = createAdminClient()
  if (enrollment.applicant_type === 'corporate' && enrollment.company_id) {
    const { data: rawCompany } = await (admin as any)
      .from('companies').select('name').eq('id', enrollment.company_id).maybeSingle()
    companyName = (rawCompany as unknown as { name: string } | null)?.name ?? null

    const { data: rawAttendees } = await (admin as any)
      .from('offline_attendees')
      .select('id, name, email, phone, department, position, cancelled_at, user_id')
      .eq('enrollment_id', enrollment.id)
      .order('created_at', { ascending: true })
    attendees = (rawAttendees as unknown as AttendeeRow[] | null) ?? []
  }

  // 본인 수료증 (이 enrollment 안) — admin client (RLS owner read 도 OK 지만 통일)
  const { data: rawCerts } = await (admin as any)
    .from('offline_certificates')
    .select('id, certificate_number, attendance_rate, issued_at, user_id, attendee_id')
    .eq('enrollment_id', enrollment.id)
  const myCerts = ((rawCerts as unknown as Array<{
    id: string
    certificate_number: string
    attendance_rate: number
    issued_at: string
    user_id: string | null
    attendee_id: string | null
  }>) ?? []).filter((c) =>
    c.user_id === user.id ||
    (c.attendee_id && attendees.some((a) => a.id === c.attendee_id && a.user_id === user.id))
  )

  const sess = enrollment.offline_sessions
  const prog = sess?.offline_programs
  const sameDay = sess && sess.start_date === sess.end_date

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/my/offline"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
      >
        <ChevronLeft className="h-4 w-4" /> 내 오프라인 신청
      </Link>

      <header className="mb-6">
        <h1 className="text-2xl font-bold text-navy">
          {prog?.title ?? '(프로그램 정보 없음)'}
          {sess?.title && <span className="ml-2 text-lg font-normal text-gray-500">— {sess.title}</span>}
        </h1>
        <p className="mt-1 text-sm text-gray-500">신청 일자 {formatDate(enrollment.created_at)}</p>
      </header>

      <StatusBanner enrollment={enrollment} />

      {sess && (
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
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
                  <p className="font-medium">{sess.location_name}</p>
                  {sess.location_address && (
                    <p className="text-xs text-gray-500">{sess.location_address}</p>
                  )}
                  {sess.location_url && (
                    <a
                      href={sess.location_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-accent hover:underline"
                    >
                      지도 보기 <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            )}
            {prog?.instructor_name && (
              <p className="text-xs text-gray-500">강사 · {prog.instructor_name}</p>
            )}
          </div>
        </section>
      )}

      {/* 단체 신청 정보 (corporate 만) */}
      {enrollment.applicant_type === 'corporate' && (
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-navy">
            <Building2 className="h-4 w-4 text-accent" /> 단체 신청 정보
          </h2>
          <dl className="flex flex-col gap-2 text-sm">
            {companyName && <Row label="회사" value={companyName} />}
            <Row label="참석 인원" value={`${enrollment.attendee_count}명`} />
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
                    {enrollment.company_contact_phone && (
                      <span className="ml-1 text-xs text-gray-500">
                        · {enrollment.company_contact_phone}
                      </span>
                    )}
                  </>
                }
              />
            )}
          </dl>
        </section>
      )}

      {/* 참석자 명단 (corporate 만) */}
      {enrollment.applicant_type === 'corporate' && attendees.length > 0 && (
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-navy">
            <Users className="h-4 w-4 text-accent" /> 참석자 명단 ({attendees.filter((a) => !a.cancelled_at).length}명)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-500">
                  <th className="px-2 py-2 text-left font-semibold">이름</th>
                  <th className="px-2 py-2 text-left font-semibold">이메일</th>
                  <th className="px-2 py-2 text-left font-semibold">전화</th>
                  <th className="px-2 py-2 text-left font-semibold">부서</th>
                  <th className="px-2 py-2 text-left font-semibold">직책</th>
                  <th className="px-2 py-2 text-left font-semibold">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendees.map((a) => (
                  <tr key={a.id} className={a.cancelled_at ? 'opacity-50' : ''}>
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

      <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-bold text-navy">결제 정보</h2>
        <dl className="flex flex-col gap-2 text-sm">
          <Row label="결제 방식" value={enrollment.payment_method === 'card' ? '카드 결제' : enrollment.payment_method === 'invoice' ? '세금계산서' : '미지정'} />
          <Row
            label="결제 금액"
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
          {enrollment.refunded_at && (
            <Row
              label="환불"
              value={
                <span className="text-blue-600">
                  {enrollment.refund_amount?.toLocaleString()}원 환불 완료
                  {enrollment.refund_rate != null && ` (${enrollment.refund_rate}%)`}
                </span>
              }
            />
          )}
        </dl>

        {/* invoice + pending — 입금 안내 페이지 link */}
        {enrollment.payment_method === 'invoice' &&
          enrollment.status === 'pending_payment' &&
          sess && (
            <Link
              href={`/offline/${prog?.slug}/apply/${sess.id}/invoice-success?enrollment_id=${enrollment.id}`}
              className="mt-4 inline-flex items-center gap-1 rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-light"
            >
              💳 입금 안내 다시 보기
            </Link>
          )}
      </section>

      {/* QR 출석 안내 */}
      {enrollment.status === 'confirmed' && (
        <section className="mb-6 rounded-2xl bg-accent-pale/30 p-5">
          <div className="flex items-start gap-3">
            <QrCode className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
            <div className="flex-1">
              <h2 className="text-sm font-bold text-navy">QR 출석 체크</h2>
              <p className="mt-1 text-xs text-gray-600">
                강좌 당일 현장의 QR 코드를 스마트폰 카메라로 스캔하세요. 자동 로그인 확인 후 출석 처리됩니다.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 수료증 — 발급된 경우 */}
      {myCerts.length > 0 && (
        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-navy">
            <Award className="h-4 w-4 text-accent" /> 수료증
          </h2>
          {myCerts.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg bg-green-50 p-3">
              <div>
                <p className="text-sm font-medium text-green-800">{c.certificate_number}</p>
                <p className="mt-0.5 text-xs text-green-700">
                  출석률 {c.attendance_rate}% · 발급 {formatDate(c.issued_at)}
                </p>
              </div>
              <Link
                href={`/api/offline/certificates/${c.id}/download`}
                target="_blank"
                className="inline-block rounded-lg bg-green-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
              >
                PDF 다운로드
              </Link>
            </div>
          ))}
        </section>
      )}

      {/* 취소 — pending_payment 또는 confirmed 만 */}
      {(enrollment.status === 'pending_payment' || enrollment.status === 'confirmed') && sess && (
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-bold text-navy">신청 취소</h2>
          {enrollment.status === 'pending_payment' ? (
            <p className="mb-3 text-xs text-gray-600">
              결제 대기 중인 신청은 환불 절차 없이 즉시 취소됩니다.
            </p>
          ) : (
            <p className="mb-3 text-xs text-gray-600">
              회차별 환불 정책에 따라 환불액이 자동 계산됩니다.
              {enrollment.payment_method === 'card'
                ? ' 카드 자동 환불 (영업일 3-7일).'
                : ' 세금계산서 결제는 운영팀 수동 환불.'}
            </p>
          )}
          <OfflineCancelButton
            enrollmentId={enrollment.id}
            status={enrollment.status as 'pending_payment' | 'confirmed'}
            preview={
              enrollment.status === 'pending_payment'
                ? { rate: 0, amount: 0, paymentMethod: enrollment.payment_method }
                : (() => {
                    const r = calculateRefund(
                      enrollment.total_amount,
                      sess.start_date,
                      enrollment.refund_policy_snapshot
                    )
                    return {
                      rate: r.rate,
                      amount: r.amount,
                      paymentMethod: enrollment.payment_method,
                    }
                  })()
            }
          />
        </section>
      )}

      {enrollment.notes && (
        <section className="mt-4 rounded-xl bg-amber-50 p-4">
          <p className="text-xs text-amber-700">
            <strong>운영자 메모:</strong> {enrollment.notes}
          </p>
        </section>
      )}
    </div>
  )
}

function StatusBanner({ enrollment }: { enrollment: EnrollmentRow }) {
  const { status, payment_due_at } = enrollment

  if (status === 'pending_payment') {
    const due = new Date(payment_due_at)
    const dueText = due.toLocaleString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
      timeZone: 'Asia/Seoul',
    })
    const isPast = due.getTime() < Date.now()
    return (
      <section className={`mb-6 rounded-2xl p-5 ${isPast ? 'bg-red-50' : 'bg-amber-50'}`}>
        <div className="flex items-start gap-3">
          {isPast ? <AlertCircle className="mt-0.5 h-5 w-5 text-red-600" /> : <Clock className="mt-0.5 h-5 w-5 text-amber-600" />}
          <div className="flex-1">
            <p className={`text-sm font-bold ${isPast ? 'text-red-700' : 'text-amber-700'}`}>
              {isPast ? '결제 기한이 지났습니다' : '결제 대기 중'}
            </p>
            <p className={`mt-1 text-xs ${isPast ? 'text-red-600' : 'text-amber-700'}`}>
              결제 기한: {dueText}
              {isPast && ' (곧 시스템 자동 취소 처리됩니다)'}
            </p>
            {!isPast && (
              <p className="mt-1 text-[11px] text-amber-700">
                결제 기한 안에 결제를 완료하지 않으면 자동 취소됩니다.
                {/* 결제 재시도는 Phase 2 마무리 — 향후 라운드 */}
              </p>
            )}
          </div>
        </div>
      </section>
    )
  }
  if (status === 'confirmed') {
    return (
      <section className="mb-6 rounded-2xl bg-green-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm font-bold text-green-700">자리 확정 완료</p>
            <p className="mt-1 text-xs text-green-700">
              결제가 완료되어 자리가 확정되었습니다. 강좌 당일 QR 출석 체크 진행.
            </p>
          </div>
        </div>
      </section>
    )
  }
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <section className="mb-6 rounded-2xl bg-gray-100 p-5">
        <div className="flex items-start gap-3">
          <XCircle className="mt-0.5 h-5 w-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-700">{STATUS_LABEL[status]}</p>
            {enrollment.cancelled_at && (
              <p className="mt-1 text-xs text-gray-600">
                {new Date(enrollment.cancelled_at).toLocaleString('ko-KR', {
                  year: 'numeric', month: 'long', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul',
                })}
              </p>
            )}
          </div>
        </div>
      </section>
    )
  }
  if (status === 'expired') {
    return (
      <section className="mb-6 rounded-2xl bg-gray-100 p-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 text-gray-500" />
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-700">결제 기한 만료</p>
            <p className="mt-1 text-xs text-gray-600">
              결제가 진행되지 않아 자동 취소되었습니다.
            </p>
          </div>
        </div>
      </section>
    )
  }
  return null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-24 shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="flex-1 text-sm text-gray-700">{value}</dd>
    </div>
  )
}
