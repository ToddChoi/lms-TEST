import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ChevronLeft, Calendar, MapPin, Users } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { OfflineApplyForm } from '@/components/offline/OfflineApplyForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 교육 신청' }
export const dynamic = 'force-dynamic'

export default async function ApplyPage({
  params,
}: {
  params: { slug: string; sessionId: string }
}) {
  const supabase = createClient()

  // 로그인 필수
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?redirectTo=/offline/${params.slug}/apply/${params.sessionId}`)
  }

  // 프로그램 (slug 기반)
  const { data: rawProgram } = await supabase
    .from('offline_programs')
    .select('id, title, slug')
    .eq('slug', params.slug)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  const program = rawProgram as unknown as { id: string; title: string; slug: string } | null
  if (!program) notFound()

  // 회차 (program 일치 + open 만)
  const { data: rawSession } = await supabase
    .from('offline_sessions')
    .select(`
      id, title, start_date, end_date, capacity, price, vat_included,
      location_name, location_address, status, program_id
    `)
    .eq('id', params.sessionId)
    .eq('program_id', program.id)
    .is('deleted_at', null)
    .maybeSingle()
  const session = rawSession as unknown as {
    id: string
    title: string | null
    start_date: string
    end_date: string
    capacity: number
    price: number
    vat_included: boolean
    location_name: string | null
    location_address: string | null
    status: string
    program_id: string
  } | null
  if (!session) notFound()

  if (session.status !== 'open') {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-700">신청 가능한 회차가 아닙니다.</p>
          <p className="mt-1 text-xs text-amber-600">현재 상태: {session.status}</p>
          <Link
            href={`/offline/${program.slug}`}
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-light"
          >
            프로그램 상세로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  if (session.price <= 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
          <p className="text-sm font-semibold text-blue-700">무료 회차 신청은 곧 오픈됩니다.</p>
          <p className="mt-1 text-xs text-blue-600">현재 Phase 2 는 유료 회차 카드 결제만 지원.</p>
          <Link
            href={`/offline/${program.slug}`}
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-light"
          >
            프로그램 상세로 돌아가기
          </Link>
        </div>
      </div>
    )
  }

  // 본인 프로필 (이름 / 이메일)
  const { data: rawProfile } = await supabase
    .from('profiles').select('name, email, phone').eq('id', user.id).single()
  const profile = rawProfile as unknown as {
    name: string | null
    email: string | null
    phone: string | null
  } | null

  // 본인이 협약기업의 매니저 / 멤버인지 확인 — admin client (companies/company_members
  // 가 admin only RLS). server-side 에서만 user.id 로 filter 하므로 안전.
  // 가장 최근 활성 row 1건 → corporate 신청 시 그 회사로 자동 설정.
  const admin = createAdminClient()
  const { data: rawMembership } = await (admin as any)
    .from('company_members')
    .select('company_id, is_manager, companies(id, name, contact_name, contact_email, contact_phone)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const membership = rawMembership as unknown as {
    company_id: string
    is_manager: boolean
    companies: {
      id: string
      name: string
      contact_name: string | null
      contact_email: string | null
      contact_phone: string | null
    } | null
  } | null
  const companyForCorporate = membership?.companies ?? null

  // 이미 본인이 이 회차에 active enrollment (pending_payment OR confirmed) 가 있는지
  const { data: rawExisting } = await supabase
    .from('offline_enrollments')
    .select('id, status')
    .eq('session_id', session.id)
    .eq('applicant_user_id', user.id)
    .in('status', ['pending_payment', 'confirmed'])
    .is('deleted_at', null)
    .maybeSingle()
  const existing = rawExisting as unknown as { id: string; status: string } | null

  const sameDay = session.start_date === session.end_date

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href={`/offline/${program.slug}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
      >
        <ChevronLeft className="h-4 w-4" /> {program.title}
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-bold text-navy">신청서</h1>
        <p className="mt-1 text-sm text-gray-500">
          결제 완료 후 자리가 확정됩니다.
        </p>
      </header>

      <section className="mb-6 rounded-2xl bg-accent-pale/40 p-5">
        <h2 className="mb-3 text-sm font-bold text-navy">신청 회차</h2>
        <p className="mb-2 font-semibold text-navy">
          {program.title}
          {session.title && <span className="ml-1.5 text-sm font-normal text-gray-600">— {session.title}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5" />
            {sameDay ? formatDate(session.start_date) : `${formatDate(session.start_date)} ~ ${formatDate(session.end_date)}`}
          </span>
          {session.location_name && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {session.location_name}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            정원 {session.capacity}명
          </span>
        </div>
      </section>

      {existing ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <p className="text-sm font-semibold text-amber-700">
            이미 이 회차에 신청하셨습니다.
          </p>
          <p className="mt-1 text-xs text-amber-600">
            상태: {existing.status === 'pending_payment' ? '결제 대기 중' : '결제 완료 (자리 확정)'}
          </p>
          <Link
            href="/my"
            className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-xs font-medium text-white hover:bg-accent-light"
          >
            마이페이지로 이동
          </Link>
        </div>
      ) : (
        <OfflineApplyForm
          sessionId={session.id}
          unitPrice={session.price}
          vatIncluded={session.vat_included}
          applicantName={profile?.name ?? ''}
          applicantEmail={profile?.email ?? user.email ?? ''}
          applicantPhone={profile?.phone ?? ''}
          company={companyForCorporate}
        />
      )}
    </div>
  )
}
