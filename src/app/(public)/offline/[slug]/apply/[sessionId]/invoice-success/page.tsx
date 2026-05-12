import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { Receipt, Building2, Clock, Mail, ChevronRight } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '세금계산서 신청 접수' }
export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string; sessionId: string }
  searchParams: { enrollment_id?: string }
}

interface EnrollmentRow {
  id: string
  applicant_user_id: string
  total_amount: number
  vat_included: boolean
  payment_due_at: string
  attendee_count: number
  company_contact_name: string | null
  company_contact_email: string | null
  offline_sessions: {
    title: string | null
    start_date: string
    end_date: string
    offline_programs: { title: string } | null
  } | null
}

export default async function InvoiceSuccessPage({ params, searchParams }: Props) {
  const enrollmentId = searchParams.enrollment_id
  if (!enrollmentId) notFound()

  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?redirectTo=/offline/${params.slug}/apply/${params.sessionId}/invoice-success?enrollment_id=${enrollmentId}`)
  }

  // enrollment 본인 확인 (admin client — invoice 안내 페이지는 server-side fetch)
  const admin = createAdminClient()
  const { data: rawEnrollment } = await admin
    .from('offline_enrollments')
    .select(`
      id, applicant_user_id, total_amount, vat_included, payment_due_at,
      attendee_count, company_contact_name, company_contact_email,
      offline_sessions ( title, start_date, end_date,
        offline_programs ( title )
      )
    `)
    .eq('id', enrollmentId)
    .maybeSingle()
  const enrollment = rawEnrollment as unknown as EnrollmentRow | null
  if (!enrollment || enrollment.applicant_user_id !== user.id) notFound()

  // 입금 계좌 (site_settings)
  const { data: rawBank } = await admin
    .from('site_settings')
    .select('value')
    .eq('key', 'offline_bank_account')
    .maybeSingle()
  const bankAccount = (rawBank as unknown as { value: string | null } | null)?.value ?? ''

  const sess = enrollment.offline_sessions
  const programTitle = sess?.offline_programs?.title ?? '오프라인 교육'
  const sessionPeriod = sess
    ? sess.start_date === sess.end_date
      ? formatDate(sess.start_date)
      : `${formatDate(sess.start_date)} ~ ${formatDate(sess.end_date)}`
    : ''
  const dueDate = new Date(enrollment.payment_due_at).toLocaleString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Seoul',
  })

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-2xl bg-white p-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
          <Receipt className="h-9 w-9 text-amber-600" />
        </div>
        <h1 className="text-center text-2xl font-bold text-navy">
          세금계산서 신청 접수
        </h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          신청이 정상 접수되었습니다. 아래 안내에 따라 입금해주세요.
        </p>

        <section className="mt-6 rounded-xl bg-amber-50 p-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-amber-700">
            <Clock className="h-4 w-4" /> 결제 기한
          </h2>
          <p className="text-base font-bold text-amber-700">{dueDate} 까지</p>
          <p className="mt-1 text-xs text-amber-700">
            기한 내 미입금 시 자동 취소됩니다.
          </p>
        </section>

        <section className="mt-4 rounded-xl bg-silver p-5">
          <h2 className="mb-3 text-sm font-bold text-navy">신청 정보</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="프로그램" value={programTitle} />
            {sess?.title && <Row label="회차" value={sess.title} />}
            <Row label="일정" value={sessionPeriod} />
            <Row label="참석자" value={`${enrollment.attendee_count}명`} />
            <Row
              label="금액"
              value={
                <span className="font-bold text-navy">
                  {enrollment.total_amount.toLocaleString()}원
                  {!enrollment.vat_included && (
                    <span className="ml-1 text-xs font-normal text-gray-500">(VAT 별도)</span>
                  )}
                </span>
              }
            />
            {enrollment.company_contact_name && (
              <Row
                label="담당자"
                value={`${enrollment.company_contact_name} (${enrollment.company_contact_email ?? '-'})`}
              />
            )}
          </dl>
        </section>

        <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-blue-700">
            <Building2 className="h-4 w-4" /> 입금 계좌
          </h2>
          {bankAccount ? (
            <pre className="whitespace-pre-wrap rounded bg-white px-3 py-2 font-mono text-sm text-navy">
              {bankAccount}
            </pre>
          ) : (
            <p className="text-sm text-blue-700">
              입금 계좌 정보가 등록되지 않았습니다. 운영팀에 문의해주세요.
            </p>
          )}
          <p className="mt-3 text-xs text-blue-700">
            입금자명에 <strong>회사명</strong> 또는 <strong>담당자 이름</strong> 을 명시해주세요.
          </p>
        </section>

        <section className="mt-4 rounded-xl bg-silver p-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-navy">
            <Mail className="h-4 w-4" /> 다음 단계
          </h2>
          <ol className="ml-5 list-decimal text-sm text-gray-700 space-y-1">
            <li>위 계좌로 입금</li>
            <li>운영자가 입금 확인 (영업일 1-2일 이내)</li>
            <li>자리 확정 알림 메일 발송 (담당자 이메일)</li>
            <li>마이페이지에서 확정 상태 확인 가능</li>
          </ol>
        </section>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Link
            href={`/my/offline/${enrollment.id}`}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-accent-light"
          >
            신청 상세 보기 <ChevronRight className="h-4 w-4" />
          </Link>
          <Link
            href={`/offline/${params.slug}`}
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm text-gray-600 hover:bg-silver"
          >
            프로그램 상세로
          </Link>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-20 shrink-0 text-xs text-gray-500">{label}</dt>
      <dd className="flex-1 text-sm text-gray-700">{value}</dd>
    </div>
  )
}
