import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import CmsSectionManager from '@/components/admin/CmsSectionManager'
import type { CmsHomeSection } from '@/components/admin/SectionConfigDrawer'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '홈페이지 관리' }

export default async function AdminCmsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const { data: rawSections } = await supabase
    .from('home_sections')
    .select('id, type, label, title, subtitle, sort_order, is_visible, config')
    .order('sort_order')
  const sections = (rawSections as unknown as CmsHomeSection[] | null) ?? []

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#0B1F3A]">홈페이지 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          메인 홈 페이지 섹션 구조·콘텐츠를 관리합니다. 배너는 banner 타입 섹션의 [설정] 버튼에서 관리할 수 있습니다.
        </p>
      </div>

      {/*
        P2 페이지 빌더 진입 — content_blocks 기반 신버전.
        디자인 토큰(text-body-sm / text-caption / border-accent/20) 미컴파일 시
        묻혀 보일 수 있어 Tailwind 기본 클래스(text-sm / text-xs)로 작성.
      */}
      <div className="mb-6 rounded-xl border-2 border-blue-500 bg-blue-50 p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full bg-blue-500 px-2.5 py-0.5 text-xs font-bold text-white">
            BETA
          </span>
          <p className="text-base font-bold text-navy">새 페이지 빌더 — content_blocks 기반</p>
        </div>
        <p className="mt-2 text-sm text-gray-700">
          block 단위로 페이지를 구성합니다. 회사별 랜딩·B2B 페이지·약관 페이지를 코드 변경 없이 만들 수 있습니다.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href="/admin/cms/builder/home"
            className="rounded-md border-2 border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white"
          >
            홈 페이지 빌더 →
          </a>
          <a
            href="/admin/cms/builder/b2b"
            className="rounded-md border-2 border-blue-600 bg-white px-4 py-2 text-sm font-semibold text-blue-700 transition hover:bg-blue-600 hover:text-white"
          >
            B2B 랜딩 빌더 →
          </a>
        </div>
      </div>

      <CmsSectionManager initialSections={sections} />
    </div>
  )
}
