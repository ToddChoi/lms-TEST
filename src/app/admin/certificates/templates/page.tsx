import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import type { Metadata } from 'next'
import type { CertificateTemplate } from '@/types/database'

export const metadata: Metadata = { title: '수료증 템플릿' }

export default async function CertTemplatesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawTemplates } = await supabase
    .from('certificate_templates')
    .select('*')
    .order('updated_at', { ascending: false })
  const templates = (rawTemplates as unknown as CertificateTemplate[] | null) ?? []

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-h3 text-navy">수료증 템플릿</h1>
          <p className="mt-1 text-body-sm text-gray-500">
            수료증 디자인을 element 단위로 편집합니다. 기본 템플릿이 새 수료증 발급 시 자동 적용됩니다.
          </p>
        </div>
        <Link
          href="/admin/certificates/templates/new"
          className="rounded-md bg-accent px-4 py-2 text-body-sm font-semibold text-white hover:bg-accent-light"
        >
          + 템플릿 추가
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle p-12 text-center text-body-sm text-gray-500">
          템플릿이 없습니다. supabase/migration_phase6_certificate_templates.sql 실행이 필요할 수 있습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface p-4 shadow-elev-1">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-navy">{t.name}</span>
                  {t.is_default && (
                    <span className="rounded bg-success-soft px-1.5 py-0.5 text-micro font-medium text-success">기본</span>
                  )}
                  <span className="rounded bg-surface-muted px-1.5 py-0.5 text-micro text-gray-600">
                    {t.page_size} · {t.page_orientation}
                  </span>
                  <span className="text-caption text-gray-500">elements {Array.isArray(t.elements) ? t.elements.length : 0}</span>
                </div>
                {t.description && <p className="mt-0.5 truncate text-caption text-gray-500">{t.description}</p>}
              </div>
              <Link
                href={`/admin/certificates/templates/${t.id}`}
                className="shrink-0 rounded-md border border-accent bg-surface px-3 py-1.5 text-caption text-accent hover:bg-accent-pale"
              >
                편집 →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
