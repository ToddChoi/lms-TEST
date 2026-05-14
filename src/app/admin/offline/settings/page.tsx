import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OfflineSettingsForm } from '@/components/admin/offline/OfflineSettingsForm'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 설정' }
export const dynamic = 'force-dynamic'

interface SettingRow {
  key: string
  value: string | null
  label: string | null
}

export default async function AdminOfflineSettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawRows } = await supabase
    .from('site_settings')
    .select('key, value, label')
    .eq('group_name', 'offline')
    .order('key')
  const rows = (rawRows as unknown as SettingRow[] | null) ?? []

  const settings = Object.fromEntries(
    rows.map((r) => [r.key, r.value ?? ''])
  ) as Record<string, string>

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">오프라인 설정</h1>
        <p className="mt-1 text-sm text-gray-500">
          결제 기한 / 환불 정책 / QR 활성 시간 / 입금 계좌 등 글로벌 설정.
          회차별 오버라이드는 회차 편집 페이지에서.
        </p>
      </div>
      <OfflineSettingsForm initial={settings} />
    </div>
  )
}
