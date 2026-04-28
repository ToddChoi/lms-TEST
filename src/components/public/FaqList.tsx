'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, HelpCircle, Search } from 'lucide-react'

export interface FaqItem {
  id: string
  question: string
  answer: string
  category: string | null
}

interface Props {
  initialFaqs: FaqItem[]
}

const CATEGORIES = [
  { key: 'all',      label: '전체' },
  { key: 'general',  label: '일반' },
  { key: 'account',  label: '계정' },
  { key: 'payment',  label: '결제' },
  { key: 'course',   label: '강좌' },
] as const

type CategoryKey = (typeof CATEGORIES)[number]['key']

export default function FaqList({ initialFaqs }: Props) {
  const [active, setActive] = useState<CategoryKey>('all')
  const [keyword, setKeyword] = useState('')

  const filtered = useMemo(() => {
    let list = initialFaqs
    if (active !== 'all') {
      list = list.filter((f) => (f.category ?? 'general') === active)
    }
    const q = keyword.trim().toLowerCase()
    if (q) {
      list = list.filter(
        (f) =>
          f.question.toLowerCase().includes(q) ||
          f.answer.toLowerCase().includes(q)
      )
    }
    return list
  }, [initialFaqs, active, keyword])

  return (
    <div>
      {/* 검색 + 탭 */}
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              onClick={() => setActive(c.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active === c.key
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색"
            className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent sm:w-56"
          />
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="flex flex-col gap-3">
          {filtered.map((faq) => (
            <details key={faq.id} className="group rounded-2xl bg-white shadow-sm overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4">
                <span className="flex items-center gap-2 font-medium text-navy">
                  {faq.category && (
                    <span className="rounded-full bg-accent-pale px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {labelOf(faq.category)}
                    </span>
                  )}
                  {faq.question}
                </span>
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
          <p className="mt-4 text-gray-400">
            {keyword ? '검색 결과가 없습니다.' : '등록된 FAQ가 없습니다.'}
          </p>
        </div>
      )}
    </div>
  )
}

function labelOf(category: string) {
  return CATEGORIES.find((c) => c.key === category)?.label ?? category
}
