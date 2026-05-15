import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { CloseModalButton } from './CloseModalButton'

const ROLE_LABELS: Record<string, string> = {
  student: '학생',
  instructor: '강사',
  org_admin: '기업 매니저',
  admin: '관리자',
  superadmin: '최고관리자',
}

/**
 * Intercepting + Parallel route — /admin/users 에서 row 클릭 시 modal 로 표시.
 *
 * 같은 URL (/admin/users/[id]) 이지만:
 *   - 목록에서 클릭 (soft navigation): 이 modal 페이지 렌더
 *   - 직접 URL 접근 / 새로고침: 본 [id]/page.tsx 풀 페이지 렌더
 *
 * server component — DB 직접 조회 가능 (학생 진도까진 아닌 가벼운 미리보기).
 */
export default async function UserModalPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select('id, name, email, role, phone, company, department, is_active, created_at')
    .eq('id', params.id)
    .single()
  const profile = rawProfile as unknown as {
    id: string
    name: string | null
    email: string | null
    role: string
    phone: string | null
    company: string | null
    department: string | null
    is_active: boolean
    created_at: string
  } | null

  if (!profile) notFound()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-modal-title"
    >
      {/* backdrop click → close (router.back) */}
      <CloseModalButton className="absolute inset-0" aria-label="닫기" />

      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="user-modal-title" className="text-lg font-bold text-[#0B1F3A]">
              {profile.name ?? '이름 없음'}
            </h2>
            <p className="text-xs text-gray-500">{profile.email ?? '-'}</p>
          </div>
          <CloseModalButton className="rounded-lg p-2 text-gray-400 hover:bg-gray-50 hover:text-gray-700" aria-label="닫기">
            ✕
          </CloseModalButton>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-gray-500">역할</dt>
            <dd className="font-medium text-[#0B1F3A]">{ROLE_LABELS[profile.role] ?? profile.role}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">활성</dt>
            <dd className="font-medium">
              {profile.is_active
                ? <span className="text-green-600">활성</span>
                : <span className="text-red-500">비활성</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">전화번호</dt>
            <dd className="font-medium text-[#0B1F3A]">{profile.phone ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">가입일</dt>
            <dd className="font-medium text-[#0B1F3A]">{formatDate(profile.created_at)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">회사</dt>
            <dd className="font-medium text-[#0B1F3A]">{profile.company ?? '-'}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">부서</dt>
            <dd className="font-medium text-[#0B1F3A]">{profile.department ?? '-'}</dd>
          </div>
        </dl>

        <div className="mt-6 flex items-center justify-end gap-2">
          <CloseModalButton className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-600 hover:bg-gray-50">
            닫기
          </CloseModalButton>
          <Link
            href={`/admin/users/${profile.id}`}
            scroll={false}
            className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-light"
          >
            전체 페이지 →
          </Link>
        </div>
      </div>
    </div>
  )
}
