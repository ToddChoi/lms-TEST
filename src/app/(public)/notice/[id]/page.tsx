import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Bell, ArrowLeft, Eye } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import type { Metadata } from 'next'

interface Props {
  params: { id: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('notices')
    .select('title')
    .eq('id', params.id)
    .maybeSingle()
  const notice = data as unknown as { title: string } | null
  return { title: notice ? `${notice.title} — 공지사항` : '공지사항' }
}

export default async function NoticeDetailPage({ params }: Props) {
  const supabase = createClient()

  const { data: rawNotice } = await supabase
    .from('notices')
    .select('id, title, content, is_pinned, is_active, view_count, created_at, updated_at')
    .eq('id', params.id)
    .maybeSingle()

  type Notice = {
    id: string; title: string; content: string | null
    is_pinned: boolean; is_active: boolean
    view_count: number | null
    created_at: string; updated_at: string | null
  }
  const notice = rawNotice as unknown as Notice | null
  if (!notice || !notice.is_active) notFound()

  // 조회수 +1 (실패해도 본문 노출은 영향 없음)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any).rpc('increment_notice_views', { p_notice_id: params.id }).then(() => {}, () => {})

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <Link
        href="/notice"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" /> 공지사항 목록
      </Link>

      <article className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <header className="border-b border-gray-100 px-6 py-5 sm:px-8">
          <div className="flex items-center gap-2 text-xs text-gray-400">
            {notice.is_pinned && (
              <span className="rounded-full bg-accent px-2 py-0.5 font-medium text-white">
                공지
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Bell className="h-3.5 w-3.5" /> {formatDate(notice.created_at)}
            </span>
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> {(notice.view_count ?? 0).toLocaleString()}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-navy sm:text-3xl">
            {notice.title}
          </h1>
        </header>

        <div className="px-6 py-8 sm:px-8 text-[15px] text-gray-700 leading-relaxed whitespace-pre-line">
          {notice.content || <span className="text-gray-400">본문이 없습니다.</span>}
        </div>
      </article>

      <div className="mt-8 flex justify-center">
        <Link
          href="/notice"
          className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm text-gray-600 hover:border-accent hover:text-accent transition"
        >
          목록으로
        </Link>
      </div>
    </div>
  )
}
