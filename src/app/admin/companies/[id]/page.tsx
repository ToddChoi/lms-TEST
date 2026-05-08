import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { CompanyForm } from '@/components/admin/CompanyForm'
import { CompanyMemberManager } from '@/components/admin/CompanyMemberManager'
import { CompanyCollectionsManager } from '@/components/admin/CompanyCollectionsManager'
import { DeleteCompanyButton } from './DeleteCompanyButton'

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawCompany } = await supabase
    .from('companies')
    .select('id, name, contact_name, contact_email, contract_start, contract_end, is_active, created_at')
    .eq('id', params.id)
    .single()
  const company = rawCompany as unknown as {
    id: string
    name: string
    contact_name: string | null
    contact_email: string | null
    contract_start: string | null
    contract_end: string | null
    is_active: boolean
    created_at: string
  } | null

  if (!company) notFound()

  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('id, user_id, department, is_manager, profiles(name, email)')
    .eq('company_id', params.id)
    .order('created_at', { ascending: true })

  const membersRaw = rawMembers as unknown as {
    id: string
    user_id: string
    department: string | null
    is_manager: boolean
    profiles: { name: string | null; email: string | null } | null
  }[] | null

  const members = (membersRaw ?? []).map((m) => ({
    id: m.id,
    user_id: m.user_id,
    department: m.department,
    is_manager: m.is_manager,
    name: m.profiles?.name ?? null,
    email: m.profiles?.email ?? null,
  }))

  return (
    <div className="p-4 sm:p-6 lg:p-8 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/admin/companies" className="text-sm text-[#2D7DD2] hover:underline">
            ← 목록으로
          </Link>
          <h1 className="text-2xl font-bold text-[#0B1F3A] mt-2">{company.name}</h1>
        </div>
        <DeleteCompanyButton companyId={company.id} />
      </div>

      <section>
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-3">기업 정보</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 max-w-2xl">
          <CompanyForm
            mode="edit"
            initialValues={{
              id: company.id,
              name: company.name,
              contact_name: company.contact_name ?? '',
              contact_email: company.contact_email ?? '',
              contract_start: company.contract_start ?? '',
              contract_end: company.contract_end ?? '',
              is_active: company.is_active,
            }}
          />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-3">회원 관리</h2>
        <CompanyMemberManager companyId={company.id} initialMembers={members} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-3">강좌 큐레이션</h2>
        <CompanyCollectionsManager companyId={company.id} />
      </section>

      <section>
        <h2 className="text-lg font-semibold text-[#0B1F3A] mb-3">회사 전용 페이지</h2>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
          <p className="text-sm text-gray-600">
            이 회사 subdomain 진입자에게만 노출되는 홈/B2B 페이지를 별도로 편집할 수 있습니다.
            기본 페이지는 모든 사용자에게 보이는 것과 분리됩니다.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/admin/cms/builder/home?scope=company&company=${company.id}`}
              className="rounded-md border border-accent bg-white px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-white transition"
            >
              회사 전용 홈 빌더 →
            </Link>
            <Link
              href={`/admin/cms/builder/b2b?scope=company&company=${company.id}`}
              className="rounded-md border border-accent bg-white px-3 py-1.5 text-sm font-semibold text-accent hover:bg-accent hover:text-white transition"
            >
              회사 전용 B2B 빌더 →
            </Link>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            ⓘ 회사 subdomain 셋업 후 활성화. 현재는 ?tenant={company.id} 쿼리로 시연 가능.
          </p>
        </div>
      </section>
    </div>
  )
}
