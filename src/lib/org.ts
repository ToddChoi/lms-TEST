import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function requireManagerCompany() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawMembership } = await supabase
    .from('company_members')
    .select('company_id, is_manager, companies(id, name)')
    .eq('user_id', user.id)
    .eq('is_manager', true)
    .limit(1)
    .maybeSingle()
  const membership = rawMembership as unknown as {
    company_id: string
    is_manager: boolean
    companies: { id: string; name: string } | null
  } | null

  if (!membership || !membership.is_manager) redirect('/')

  return {
    supabase,
    user,
    companyId: membership.company_id,
    companyName: membership.companies?.name ?? '',
  }
}

export async function getCompanyMemberIds(
  supabase: ReturnType<typeof createClient>,
  companyId: string
): Promise<string[]> {
  const { data: rawMembers } = await supabase
    .from('company_members')
    .select('user_id')
    .eq('company_id', companyId)
  const members = rawMembers as unknown as { user_id: string }[] | null
  return (members ?? []).map((m) => m.user_id)
}
