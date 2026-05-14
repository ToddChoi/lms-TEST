import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WaitlistButton } from '@/components/offline/WaitlistButton'
import {
  Calendar, MapPin, Users, Award, CheckCircle2,
  AlertCircle, ChevronLeft,
} from 'lucide-react'
import { sanitizeHtml } from '@/lib/sanitize'
import { formatDate } from '@/lib/utils'
import {
  OFFLINE_PROGRAM_TYPE_LABEL,
  OFFLINE_SESSION_STATUS_LABEL,
  type OfflineProgramType,
  type OfflineSessionStatus,
} from '@/types/database'
import dayjs from '@/lib/dayjs'
import type { Metadata } from 'next'

export const revalidate = 60

interface ProgramRow {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  program_type: OfflineProgramType
  instructor_name: string | null
  instructor_bio: string | null
  what_you_learn: string[]
  requirements: string[]
  target_audience: string | null
  completion_attendance_rate: number
  categories: { name: string; slug: string } | null
}

interface SessionRow {
  id: string
  title: string | null
  start_date: string
  end_date: string
  capacity: number
  price: number
  vat_included: boolean
  location_name: string | null
  location_address: string | null
  status: OfflineSessionStatus
}

async function getProgram(slug: string): Promise<ProgramRow | null> {
  const supabase = createClient()
  const { data } = await supabase
    .from('offline_programs')
    .select(`
      id, title, slug, description, thumbnail_url,
      program_type, instructor_name, instructor_bio,
      what_you_learn, requirements, target_audience,
      completion_attendance_rate,
      categories(name, slug)
    `)
    .eq('slug', slug)
    .eq('status', 'active')
    .is('deleted_at', null)
    .maybeSingle()
  return data as unknown as ProgramRow | null
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string }
}): Promise<Metadata> {
  const p = await getProgram(params.slug)
  if (!p) return { title: '오프라인 교육' }
  return {
    title: p.title,
    description: (p.description ?? '').slice(0, 160) || `${p.title} — 오프라인 교육 프로그램`,
  }
}

export default async function OfflineProgramDetailPage({
  params,
}: {
  params: { slug: string }
}) {
  const program = await getProgram(params.slug)
  if (!program) notFound()

  const supabase = createClient()
  const today = dayjs().format('YYYY-MM-DD')
  const { data: { user } } = await supabase.auth.getUser()

  // 진행 예정 / 진행 중 회차만 (지난 회차는 별도)
  const { data: rawSessions } = await supabase
    .from('offline_sessions')
    .select('id, title, start_date, end_date, capacity, price, vat_included, location_name, location_address, status')
    .eq('program_id', program.id)
    .is('deleted_at', null)
    .gte('end_date', today)
    .in('status', ['open', 'closed'])
    .order('start_date', { ascending: true })
  const sessions = (rawSessions as unknown as SessionRow[] | null) ?? []

  // 본인의 활성 대기열 (waiting / notified) — admin client (waitlist 가 admin only RLS)
  let myWaitlists: Record<string, string> = {}  // sessionId → waitlistId
  if (user && sessions.length > 0) {
    const admin = createAdminClient()
    const { data: rawWaitlists } = await (admin as any)
      .from('offline_waitlist')
      .select('id, session_id')
      .eq('user_id', user.id)
      .in('session_id', sessions.map((s) => s.id))
      .in('status', ['waiting', 'notified'])
    const wl = (rawWaitlists as unknown as Array<{ id: string; session_id: string }> | null) ?? []
    myWaitlists = Object.fromEntries(wl.map((w) => [w.session_id, w.id]))
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link
        href="/offline"
        className="mb-4 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
      >
        <ChevronLeft className="h-4 w-4" /> 오프라인 교육 목록
      </Link>

      <header className="mb-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="inline-block rounded-full bg-accent-pale px-2.5 py-0.5 text-xs font-medium text-accent">
            {OFFLINE_PROGRAM_TYPE_LABEL[program.program_type]}
          </span>
          {program.categories && (
            <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
              {program.categories.name}
            </span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-navy">{program.title}</h1>
        {program.instructor_name && (
          <p className="mt-2 text-sm text-gray-500">강사 · {program.instructor_name}</p>
        )}
      </header>

      {program.thumbnail_url && (
        <div className="mb-8 overflow-hidden rounded-2xl bg-silver">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={program.thumbnail_url}
            alt={program.title}
            className="aspect-[16/8] w-full object-cover"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_320px]">
        {/* 본문 */}
        <div className="flex flex-col gap-6">
          {program.description && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-navy">프로그램 소개</h2>
              <div
                className="prose prose-sm max-w-none text-gray-700"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(program.description) }}
              />
            </section>
          )}

          {program.what_you_learn.length > 0 && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-navy">학습 목표</h2>
              <ul className="flex flex-col gap-2">
                {program.what_you_learn.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {program.requirements.length > 0 && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-navy">사전 요구사항</h2>
              <ul className="flex flex-col gap-2">
                {program.requirements.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {program.target_audience && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-navy">대상</h2>
              <p className="text-sm text-gray-700">{program.target_audience}</p>
            </section>
          )}

          {program.instructor_bio && (
            <section className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-navy">강사 소개</h2>
              <p className="text-sm text-gray-700 whitespace-pre-line">{program.instructor_bio}</p>
            </section>
          )}

          <section className="rounded-2xl bg-accent-pale/40 p-6">
            <h2 className="mb-1 inline-flex items-center gap-1.5 text-sm font-bold text-navy">
              <Award className="h-4 w-4 text-accent" /> 수료 조건
            </h2>
            <p className="text-sm text-gray-700">
              회차 전체 일정 중 출석률 <strong>{program.completion_attendance_rate}%</strong> 이상
            </p>
          </section>
        </div>

        {/* 회차 사이드바 */}
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-1.5 text-sm font-bold text-navy">
              <Calendar className="h-4 w-4 text-accent" /> 개설 회차
            </h2>

            {sessions.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
                현재 개설된 회차가 없습니다.
                <br />
                추후 공지를 기다려주세요.
              </p>
            ) : (
              <ul className="flex flex-col gap-3">
                {sessions.map((s) => {
                  const sameDay = s.start_date === s.end_date
                  const isClosed = s.status === 'closed'
                  return (
                    <li
                      key={s.id}
                      className={`rounded-xl border p-3 ${
                        isClosed ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'
                      }`}
                    >
                      {s.title && (
                        <p className="mb-1 text-xs font-semibold text-gray-500">{s.title}</p>
                      )}
                      <p className="text-sm font-medium text-navy">
                        {sameDay
                          ? formatDate(s.start_date)
                          : `${formatDate(s.start_date)} ~ ${formatDate(s.end_date)}`}
                      </p>
                      {s.location_name && (
                        <p className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500">
                          <MapPin className="h-3 w-3" /> {s.location_name}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 text-gray-600">
                          <Users className="h-3 w-3 text-gray-400" /> 정원 {s.capacity}명
                        </span>
                        <span className="font-medium text-navy">
                          {s.price === 0
                            ? '무료'
                            : `${s.price.toLocaleString()}원${s.vat_included ? '' : ' (VAT 별도)'}`}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
                            isClosed
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {OFFLINE_SESSION_STATUS_LABEL[s.status]}
                        </span>
                        {!isClosed && s.price > 0 ? (
                          <Link
                            href={`/offline/${program.slug}/apply/${s.id}`}
                            className="rounded-lg bg-accent px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-accent-light"
                          >
                            신청하기 →
                          </Link>
                        ) : isClosed ? (
                          <WaitlistButton
                            sessionId={s.id}
                            existingWaitlistId={myWaitlists[s.id] ?? null}
                            redirectTo={`/offline/${program.slug}`}
                            isLoggedIn={!!user}
                          />
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="무료 회차 신청은 곧 오픈됩니다"
                            className="cursor-not-allowed rounded-lg bg-gray-200 px-3 py-1 text-[11px] font-medium text-gray-500"
                          >
                            준비 중
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-[11px] leading-relaxed text-blue-700">
              <strong>📢 안내</strong>: 카드 결제로 즉시 신청 가능합니다.
              세금계산서·기업 단체 신청은 곧 오픈됩니다.
            </p>
          </div>
        </aside>
      </div>

      {/* 빈 상태 fallback */}
      {!program.description && program.what_you_learn.length === 0 &&
        program.requirements.length === 0 && !program.target_audience && (
          <p className="mt-8 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-center text-sm text-gray-400">
            상세 정보 준비 중입니다.
          </p>
      )}
    </div>
  )
}
