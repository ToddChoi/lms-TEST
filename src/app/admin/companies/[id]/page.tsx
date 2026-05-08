import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { CompanyForm } from '@/components/admin/CompanyForm'
import { CompanyMemberManager } from '@/components/admin/CompanyMemberManager'
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
    </div>
  )
}
