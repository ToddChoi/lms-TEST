import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Users, BookOpen, Award, ArrowRight, Building2 } from 'lucide-react'

export default async function OrgAdminDashboard() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // 매니저 회사
  const { data: rawMembership } = await supabase
    .from('company_members')
    .select('company_id, companies(name)')
    .eq('user_id', user.id)
    .eq('is_manager', true)
    .limit(1)
    .maybeSingle()
  const m = rawMembership as unknown as {
    company_id: string
    companies: { name: string } | null
  } | null
  if (!m) redirect('/')

  // 자사 직원 user_id 목록
  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', m.company_id)
  const memberIds = (rawMembers as unknown as { user_id: string }[] | null ?? []).map((x) => x.user_id)

  // KPI 계산
  let activeEnroll = 0, completed = 0, certs = 0
  if (memberIds.length > 0) {
    const [{ count: a }, { count: c }, { count: ct }] = await Promise.all([
      supabase.from('enrollments').select('*', { count: 'exact', head: true })
        .eq('status', 'active').in('user_id', memberIds),
      supabase.from('enrollments').select('*', { count: 'exact', head: true })
        .eq('status', 'completed').in('user_id', memberIds),
      supabase.from('certificates').select('*', { count: 'exact', head: true })
        .in('user_id', memberIds),
    ])
    activeEnroll = a ?? 0
    completed = c ?? 0
    certs = ct ?? 0
  }

  const stats = [
    { label: '직원 수',     value: memberIds.length, icon: Users,    bg: 'bg-blue-50',   color: 'text-blue-600' },
    { label: '활성 수강',   value: activeEnroll,     icon: BookOpen, bg: 'bg-accent-pale', color: 'text-accent' },
    { label: '수료 완료',   value: completed,        icon: Award,    bg: 'bg-green-50',  color: 'text-green-600' },
    { label: '발급 수료증', value: certs,            icon: Award,    bg: 'bg-yellow-50', color: 'text-yellow-700' },
  ]

  return (
    <div>
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-[#0B1F3A]">
          <Building2 className="h-6 w-6" /> {m.companies?.name ?? '기업'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          소속 직원의 학습 현황을 한눈에 확인하고 강좌를 일괄 신청할 수 있어요.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
            <div className="flex items-center gap-2">
              <s.icon className={`h-4 w-4 ${s.color}`} />
              <p className="text-sm text-gray-600">{s.label}</p>
            </div>
            <p className={`mt-1 text-2xl font-bold ${s.color}`}>{s.value.toLocaleString()}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link href="/org/admin/enroll"
          className="rounded-xl border border-gray-200 bg-white p-5 hover:border-accent hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy">강좌 일괄 신청</h3>
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-1 text-xs text-gray-500">선택한 직원에게 강좌를 한 번에 등록</p>
        </Link>
        <Link href="/org/statistics"
          className="rounded-xl border border-gray-200 bg-white p-5 hover:border-accent hover:shadow-sm transition">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-navy">학습 통계 + CSV 내보내기</h3>
            <ArrowRight className="h-4 w-4 text-gray-400" />
          </div>
          <p className="mt-1 text-xs text-gray-500">직원별 진도·수료를 CSV로 받기</p>
        </Link>
      </div>
    </div>
  )
}
