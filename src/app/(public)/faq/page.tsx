import { createClient } from '@/lib/supabase/server'
import { HelpCircle, ChevronDown } from 'lucide-react'
import type { Metadata } from 'next'

export const metadata: Metadata = { title: 'FAQ' }
export const revalidate = 60

export default async function FaqPage() {
  const supabase = createClient()
  const { data: rawFaqs } = await supabase
    .from('faqs')
    .select('id, question, answer, sort_order')
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .limit(50)

  type Faq = { id: string; question: string; answer: string }
  const faqs = rawFaqs as unknown as Faq[] | null

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

      {faqs && faqs.length > 0 ? (
        <div className="flex flex-col gap-3">
          {faqs.map((faq) => (
            <details key={faq.id} className="group rounded-2xl bg-white shadow-sm overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
                <span className="font-medium text-navy">{faq.question}</span>
                <ChevronDown className="h-4 w-4 text-gray-400 transition-transform group-open:rotate-180 shrink-0 ml-3" />
              </summary>
              <div className="border-t border-gray-100 px-5 py-4 text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                {faq.answer}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl bg-white py-20 shadow-sm">
          <HelpCircle className="h-12 w-12 text-gray-200" />
          <p className="mt-4 text-gray-400">등록된 FAQ가 없습니다.</p>
        </div>
      )}
    </div>
  )
}
