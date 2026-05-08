import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { renderMarkdown } from '@/lib/markdown'
import { sanitizeHtml } from '@/lib/sanitize'
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
        className={
          'prose prose-sm max-w-none text-body text-navy/90 ' +
          '[&_h2]:text-h3 [&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-navy ' +
          '[&_h3]:text-h4 [&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-navy ' +
          '[&_p]:my-3 [&_p]:leading-relaxed ' +
          '[&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-3 [&_ul]:space-y-1 ' +
          '[&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-3 [&_ol]:space-y-1 ' +
          '[&_blockquote]:border-l-4 [&_blockquote]:border-accent/30 [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-gray-600 ' +
          '[&_a]:text-accent [&_a]:hover:underline ' +
          '[&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:text-caption ' +
          '[&_pre]:rounded-md [&_pre]:bg-navy [&_pre]:p-3 [&_pre]:text-white [&_pre]:overflow-x-auto ' +
          '[&_img]:rounded-md [&_img]:my-4 ' +
          '[&_hr]:my-6 [&_hr]:border-border-subtle'
        }
        // pages.body 는 두 형식이 섞여 있을 수 있음:
        //   1) RichEditor 가 만든 HTML — sanitize 후 그대로 렌더
        //   2) 옛 markdown 문자열 — '<' 가 없으면 markdown 으로 간주, render 후 sanitize
        // 단순 휴리스틱: '<' 포함이면 HTML, 아니면 markdown.
        dangerouslySetInnerHTML={{
          __html: sanitizeHtml(
            (page.body ?? '').includes('<')
              ? page.body ?? ''
              : renderMarkdown(page.body ?? '')
          )
        }}
      />
    </article>
  )
}
