import { createClient } from '@/lib/supabase/server'
import { HelpCircle } from 'lucide-react'
import FaqList, { type FaqItem } from '@/components/public/FaqList'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FAQ' }
export const revalidate = 60

export default async function FaqPage() {
  const supabase = createClient()
  const { data: rawFaqs } = await supabase
    .from('faqs')
    .select('id, question, answer, category, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(200)

  const faqs = (rawFaqs as unknown as FaqItem[] | null) ?? []

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-pale">
          <HelpCircle className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">자주 묻는 질문</h1>
          <p className="text-sm text-gray-500">궁금한 점을 빠르게 확인하세요.</p>
        </div>
      </div>

      <FaqList initialFaqs={faqs} />
    </div>
  )
}
