import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { PagesManager } from '@/components/admin/PagesManager'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '페이지 관리' }

export default async function AdminPagesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-h3 text-navy">페이지 관리</h1>
        <p className="mt-1 text-body-sm text-gray-500">
          약관·개인정보처리방침·환불정책 등 정적 페이지를 관리합니다.
          공개 URL: <code className="rounded bg-surface-muted px-1.5 py-0.5">/p/[slug]</code>
        </p>
      </div>
      <PagesManager />
    </div>
  )
}
