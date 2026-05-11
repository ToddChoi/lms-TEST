import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { SessionForm } from '@/components/admin/offline/SessionForm'
import { SessionDaysEditor } from '@/components/admin/offline/SessionDaysEditor'
import type { OfflineSession, OfflineSessionDay } from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '회차 편집' }

export default async function EditSessionPage({
  params,
}: {
  params: { id: string; sessionId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  // 프로그램 사전 확인
  const { data: rawProgram } = await supabase
    .from('offline_programs')
    .select('id, title')
    .eq('id', params.id)
    .is('deleted_at', null)
    .maybeSingle()
  const program = rawProgram as unknown as { id: string; title: string } | null
  if (!program) notFound()

  // 회차 + 일자
  const { data: rawSession } = await supabase
    .from('offline_sessions')
    .select('*')
    .eq('id', params.sessionId)
    .eq('program_id', program.id)  // 프로그램 일치 검증
    .is('deleted_at', null)
    .maybeSingle()
  const session = rawSession as unknown as OfflineSession | null
  if (!session) notFound()

  const { data: rawDays } = await supabase
    .from('offline_session_days')
    .select('*')
    .eq('session_id', session.id)
    .order('day_number', { ascending: true })
  const days = (rawDays as unknown as OfflineSessionDay[] | null) ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/admin/offline/programs/${program.id}/sessions`}
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> 회차 목록
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">
          {session.title || '(이름 없음)'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">{program.title}</p>
      </div>

      <SessionForm programId={program.id} initial={session} />

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-navy">회차 일자 관리</h2>
            <p className="mt-1 text-xs text-gray-500">
              일자 추가 시 QR 토큰이 자동 발급됩니다. 활성 시간은 시작 시각 ± 글로벌 설정 (기본 30분).
            </p>
          </div>
        </div>
        <SessionDaysEditor sessionId={session.id} initial={days} />
      </section>
    </div>
  )
}
