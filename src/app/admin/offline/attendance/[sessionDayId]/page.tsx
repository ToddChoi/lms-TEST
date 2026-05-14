import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ChevronLeft, Calendar, Clock } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import { AttendanceRow } from '@/components/admin/offline/AttendanceRow'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '출석부' }
export const dynamic = 'force-dynamic'

interface DayRow {
  id: string
  session_id: string
  day_number: number
  date: string
  start_time: string
  end_time: string
  topic: string | null
  offline_sessions: {
    title: string | null
    capacity: number
    offline_programs: { title: string } | null
  } | null
}

interface RosterRow {
  enrollment_id: string
  attendee_id: string | null
  user_id: string | null
  name: string
  email: string | null
  department: string | null
  attendance_id: string | null
  status: 'present' | 'absent' | 'late' | null
  checked_at: string | null
  checked_by: 'self_qr' | 'admin' | null
  notes: string | null
}

export default async function AttendanceSheetPage({
  params,
}: {
  params: { sessionDayId: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawDay } = await supabase
    .from('offline_session_days')
    .select(`
      id, session_id, day_number, date, start_time, end_time, topic,
      offline_sessions ( title, capacity, offline_programs ( title ) )
    `)
    .eq('id', params.sessionDayId)
    .maybeSingle()
  const day = rawDay as unknown as DayRow | null
  if (!day) notFound()

  // 출석 대상 명단 — 회차의 confirmed enrollment 의 참석자 (개인 + 단체 모두)
  // 단체 attendees + 개인 enrollments 합집합. 그리고 그 일자의 출석 기록 LEFT JOIN.
  const admin = createAdminClient()

  // 1. 회차의 confirmed enrollment 목록
  const { data: rawEnrollments } = await (admin as any)
    .from('offline_enrollments')
    .select(`
      id, applicant_user_id, applicant_type,
      applicant:profiles!offline_enrollments_applicant_user_id_fkey ( name, email )
    `)
    .eq('session_id', day.session_id)
    .eq('status', 'confirmed')
    .is('deleted_at', null)
  const enrollments = (rawEnrollments as unknown as Array<{
    id: string
    applicant_user_id: string
    applicant_type: 'individual' | 'corporate'
    applicant: { name: string | null; email: string | null } | null
  }> | null) ?? []

  // 2. 단체 enrollment 의 attendees
  const corpEnrollmentIds = enrollments.filter((e) => e.applicant_type === 'corporate').map((e) => e.id)
  const { data: rawAttendees } = corpEnrollmentIds.length
    ? await (admin as any)
        .from('offline_attendees')
        .select('id, enrollment_id, name, email, department, user_id, cancelled_at')
        .in('enrollment_id', corpEnrollmentIds)
        .is('cancelled_at', null)
    : { data: [] }
  const attendees = (rawAttendees as unknown as Array<{
    id: string
    enrollment_id: string
    name: string
    email: string | null
    department: string | null
    user_id: string | null
  }> | null) ?? []

  // 3. 이 일자의 출석 기록
  const { data: rawAttendance } = await (admin as any)
    .from('offline_attendance')
    .select('id, enrollment_id, user_id, attendee_id, status, checked_at, checked_by, notes')
    .eq('session_day_id', day.id)
  const attendanceRecords = (rawAttendance as unknown as Array<{
    id: string
    enrollment_id: string
    user_id: string | null
    attendee_id: string | null
    status: 'present' | 'absent' | 'late'
    checked_at: string | null
    checked_by: 'self_qr' | 'admin'
    notes: string | null
  }> | null) ?? []

  // roster 구성
  const roster: RosterRow[] = []
  for (const e of enrollments) {
    if (e.applicant_type === 'individual') {
      const rec = attendanceRecords.find(
        (r) => r.enrollment_id === e.id && r.user_id === e.applicant_user_id
      )
      roster.push({
        enrollment_id: e.id,
        attendee_id: null,
        user_id: e.applicant_user_id,
        name: e.applicant?.name ?? '-',
        email: e.applicant?.email ?? null,
        department: null,
        attendance_id: rec?.id ?? null,
        status: rec?.status ?? null,
        checked_at: rec?.checked_at ?? null,
        checked_by: rec?.checked_by ?? null,
        notes: rec?.notes ?? null,
      })
    } else {
      const corpAttendees = attendees.filter((a) => a.enrollment_id === e.id)
      for (const a of corpAttendees) {
        const rec = attendanceRecords.find(
          (r) => r.enrollment_id === e.id && r.attendee_id === a.id
        )
        roster.push({
          enrollment_id: e.id,
          attendee_id: a.id,
          user_id: a.user_id,
          name: a.name,
          email: a.email,
          department: a.department,
          attendance_id: rec?.id ?? null,
          status: rec?.status ?? null,
          checked_at: rec?.checked_at ?? null,
          checked_by: rec?.checked_by ?? null,
          notes: rec?.notes ?? null,
        })
      }
    }
  }

  const sess = day.offline_sessions
  const prog = sess?.offline_programs
  const presentCount = roster.filter((r) => r.status === 'present').length

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/offline/attendance"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-navy"
        >
          <ChevronLeft className="h-4 w-4" /> 출결 관리
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-navy">
          {prog?.title}
          {sess?.title && <span className="ml-2 text-base font-normal text-gray-500">— {sess.title}</span>}
        </h1>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-4 w-4 text-accent" />
            {day.day_number}일차 · {formatDate(day.date)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Clock className="h-4 w-4 text-accent" />
            {day.start_time.slice(0, 5)} ~ {day.end_time.slice(0, 5)}
          </span>
          {day.topic && <span>주제: {day.topic}</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="등록 인원" count={roster.length} />
        <SummaryCard label="출석" count={presentCount} accent="text-green-600" />
        <SummaryCard label="지각" count={roster.filter((r) => r.status === 'late').length} accent="text-amber-600" />
        <SummaryCard
          label="결석 / 미체크"
          count={roster.filter((r) => !r.status || r.status === 'absent').length}
          accent="text-gray-500"
        />
      </div>

      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 bg-silver">
              <th className="px-3 py-3 text-left font-semibold text-gray-600">#</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">이름</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">이메일</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">소속</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">출석 상태</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">체크인</th>
              <th className="px-3 py-3 text-left font-semibold text-gray-600">방식</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-600">보정</th>
            </tr>
          </thead>
          <tbody>
            {roster.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-sm text-gray-400">
                  등록된 참석자가 없습니다.
                </td>
              </tr>
            ) : (
              roster.map((r, i) => (
                <AttendanceRow
                  key={`${r.enrollment_id}-${r.attendee_id ?? r.user_id}`}
                  index={i + 1}
                  sessionDayId={day.id}
                  row={r}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function SummaryCard({ label, count, accent }: { label: string; count: number; accent?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${accent ?? 'text-navy'}`}>{count}</p>
    </div>
  )
}
