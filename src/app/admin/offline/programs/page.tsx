import Link from 'next/link'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { Plus, Pencil, Briefcase, Star } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  OFFLINE_PROGRAM_TYPE_LABEL,
  OFFLINE_PROGRAM_STATUS_LABEL,
  type OfflineProgramType,
  type OfflineProgramStatus,
} from '@/types/database'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: '오프라인 프로그램 관리' }

const PAGE_SIZE = 20

const STATUS_CLASS: Record<OfflineProgramStatus, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-green-100 text-green-700',
  closed: 'bg-red-50 text-red-600',
}

interface ProgramRow {
  id: string
  title: string
  slug: string
  program_type: OfflineProgramType
  status: OfflineProgramStatus
  is_featured: boolean
  created_at: string
  categories: { name: string } | null
}

export default async function AdminOfflineProgramsPage({
  searchParams,
}: {
  searchParams: { page?: string; q?: string }
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const profile = rawProfile as unknown as { role: string } | null
  if (!profile || !['admin', 'superadmin'].includes(profile.role)) redirect('/')

  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10))
  const q = (searchParams.q ?? '').trim()
  const from = (page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  let query = supabase
    .from('offline_programs')
    .select('id, title, slug, program_type, status, is_featured, created_at, categories(name)', { count: 'exact' })
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)
  if (q) query = query.ilike('title', `%${q}%`)

  const { data: rawRows, count } = await query
  const rows = (rawRows as unknown as ProgramRow[] | null) ?? []
  const total = count ?? 0

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">오프라인 프로그램 관리</h1>
          <p className="mt-1 text-sm text-gray-500">총 {total}개</p>
        </div>
        <Link
          href="/admin/offline/programs/new"
          className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
        >
          <Plus className="h-4 w-4" /> 프로그램 추가
        </Link>
      </div>

      <form method="GET" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="프로그램명 검색"
          className="flex-1 max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-lg bg-navy px-4 py-2 text-sm font-medium text-white hover:bg-navy-light"
        >
          검색
        </button>
        {q && (
          <Link
            href="/admin/offline/programs"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 hover:bg-silver"
          >
            초기화
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={q ? '검색 결과가 없습니다' : '등록된 프로그램이 없습니다'}
          description={
            q
              ? '다른 검색어를 시도하거나 필터를 초기화해보세요.'
              : '오프라인 워크샵 / 정규 과정 / 기업 맞춤 프로그램을 등록해보세요.'
          }
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-silver">
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">프로그램</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">유형</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">카테고리</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">상태</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-600">등록일</th>
                  <th className="px-4 py-3 text-right font-semibold text-gray-600">관리</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id} className="border-b border-gray-50 hover:bg-silver/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-4 w-4 shrink-0 text-gray-300" />
                        <div>
                          <p className="font-medium text-navy line-clamp-1">{p.title}</p>
                          <p className="text-xs text-gray-400 font-mono">/{p.slug}</p>
                        </div>
                        {p.is_featured && (
                          <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" aria-label="추천" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {OFFLINE_PROGRAM_TYPE_LABEL[p.program_type]}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{p.categories?.name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[p.status]}`}>
                        {OFFLINE_PROGRAM_STATUS_LABEL[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/offline/programs/${p.id}/edit`}
                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs hover:border-accent hover:text-accent"
                      >
                        <Pencil className="h-3 w-3" /> 편집
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-6 flex justify-center">
              <Suspense fallback={null}>
                <Pagination totalCount={total} pageSize={PAGE_SIZE} />
              </Suspense>
            </div>
          )}
        </>
      )}
    </div>
  )
}
