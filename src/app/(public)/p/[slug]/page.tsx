import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { renderMarkdown } from '@/lib/markdown'
import type { Metadata } from 'next'

interface Props {
  params: { slug: string }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = createClient()
  const { data } = await supabase
    .from('pages')
    .select('title, seo')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle()
  const page = data as unknown as {
    title: string
    seo?: { title?: string; description?: string; og_image?: string; noindex?: boolean }
  } | null

  if (!page) return { title: '페이지' }

  const seo = page.seo ?? {}
  return {
    title: seo.title ?? page.title,
    description: seo.description,
    robots: seo.noindex ? { index: false, follow: false } : undefined,
    openGraph: {
      title: seo.title ?? page.title,
      description: seo.description,
      images: seo.og_image ? [{ url: seo.og_image }] : undefined,
    },
  }
}

export default async function StaticPage({ params }: Props) {
  const supabase = createClient()
  const { data } = await supabase
    .from('pages')
    .select('title, body, published_at, updated_at')
    .eq('slug', params.slug)
    .eq('status', 'published')
    .maybeSingle()

  const page = data as unknown as {
    title: string
    body: string | null
    published_at: string | null
    updated_at: string
  } | null

  if (!page) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mb-8 border-b border-border-subtle pb-6">
        <h1 className="text-h2 text-navy">{page.title}</h1>
        <p className="mt-2 text-caption text-gray-500">
          최종 수정: {new Date(page.updated_at).toLocaleDateString('ko-KR')}
        </p>
      </header>
      <div
        className="prose prose-sm max-w-none text-body text-navy/90"
        // 운영자 작성 콘텐츠 — admin role 만 작성 가능 (RLS).
        // 그러나 미래 WYSIWYG 도입 시 sanitize 필요. 현재는 markdown 렌더로 안전.
        dangerouslySetInnerHTML={{ __html: renderMarkdown(page.body ?? '') }}
      />
    </article>
  )
}
