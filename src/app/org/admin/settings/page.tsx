import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CompanySettingsForm } from '@/components/org/CompanySettingsForm'

export default async function OrgCompanySettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawMembership } = await supabase
    .from('company_members')
    .select('company_id, companies(id, name)')
    .eq('user_id', user.id)
    .eq('is_manager', true)
    .limit(1)
    .maybeSingle()
  const m = rawMembership as unknown as {
    company_id: string
    companies: { id: string; name: string } | null
  } | null
  if (!m?.companies) redirect('/')

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">회사 정보</h1>
        <p className="mt-1 text-sm text-gray-500">
          회사명을 변경하거나 추가 정보를 관리합니다.
        </p>
      </div>

      <CompanySettingsForm
        companyId={m.companies.id}
        initialName={m.companies.name}
      />
    </div>
  )
}
