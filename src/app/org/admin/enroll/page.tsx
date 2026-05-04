import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BulkEnrollForm } from '@/components/org/BulkEnrollForm'

export default async function OrgBulkEnrollPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  // 자사 직원 (매니저 본인 제외)
  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('user_id, profiles(id, name, email)')
    .eq('company_id', m.company_id)
  const members = (rawMembers as unknown as {
    user_id: string
    profiles: { id: string; name: string | null; email: string | null } | null
  }[] | null ?? [])
    .filter((x) => x.user_id !== user.id && x.profiles)
    .map((x) => ({ id: x.profiles!.id, name: x.profiles!.name, email: x.profiles!.email }))

  // 활성 강좌 목록
  const { data: rawCourses } = await supabase
    .from('courses')
    .select('id, title, level, price, categories(name)')
    .eq('status', 'active')
    .order('title')
  const courses = (rawCourses as unknown as {
    id: string
    title: string
    level: string | null
    price: number
    categories: { name: string } | null
  }[] | null) ?? []

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">강좌 일괄 신청</h1>
        <p className="mt-1 text-sm text-gray-500">
          소속 직원 중 일부 또는 전체에게 강좌를 한 번에 신청할 수 있어요.
        </p>
      </div>

      <BulkEnrollForm
        members={members}
        courses={courses.map((c) => ({
          id: c.id,
          title: c.title,
          level: c.level,
          price: c.price,
          categoryName: c.categories?.name ?? null,
        }))}
      />
    </div>
  )
}
