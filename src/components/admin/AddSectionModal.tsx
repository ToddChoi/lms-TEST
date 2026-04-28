'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

export const SECTION_TYPES = [
  { type: 'hero',             emoji: '🖼️',  name: '히어로',    desc: '대형 헤딩·CTA 버튼' },
  { type: 'banner',           emoji: '📢',  name: '배너',      desc: '이미지 슬라이드쇼' },
  { type: 'featured_courses', emoji: '📚',  name: '추천 강좌', desc: '강좌 카드 목록' },
  { type: 'categories',       emoji: '🏷️',  name: '카테고리',  desc: '카테고리 그리드' },
  { type: 'stats',            emoji: '📊',  name: '주요 지표', desc: '수치 통계 표시' },
  { type: 'custom_html',      emoji: '</>',  name: '커스텀',    desc: '직접 HTML 입력' },
]

interface Props {
  onClose: () => void
  onAdd: (type: string, label: string) => Promise<void>
}

export default function AddSectionModal({ onClose, onAdd }: Props) {
  const [selectedType, setSelectedType] = useState('')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit() {
    if (!selectedType) { setError('섹션 타입을 선택해주세요.'); return }
    if (!label.trim()) { setError('관리자 라벨을 입력해주세요.'); return }
    setLoading(true)
    setError('')
    try {
      await onAdd(selectedType, label.trim())
      onClose()
    } catch (e: any) {
      setError(e.message ?? '섹션 추가 실패')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#0B1F3A]">섹션 추가</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition">
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-gray-700 mb-3">섹션 타입을 선택하세요</p>
          <div className="grid grid-cols-3 gap-3">
            {SECTION_TYPES.map((t) => (
              <button
                key={t.type}
                onClick={() => { setSelectedType(t.type); setError('') }}
                className={`flex flex-col items-start gap-1.5 p-4 rounded-xl border-2 text-left transition ${
                  selectedType === t.type
                    ? 'border-[#2D7DD2] bg-[#E8F2FC]'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="text-2xl leading-none">{t.emoji}</span>
                <span className="text-sm font-semibold text-[#0B1F3A]">{t.name}</span>
                <span className="text-xs text-gray-500 leading-snug">{t.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            관리자 라벨 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="예) 메인 배너, 여름 특별 강좌"
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          />
          <p className="text-xs text-gray-400 mt-1">동일 타입 섹션이 여러 개일 때 구분하는 이름입니다.</p>
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-5 py-2 bg-[#2D7DD2] text-white rounded-lg text-sm font-medium hover:bg-[#2566b0] transition disabled:opacity-60"
          >
            {loading ? '추가 중...' : '섹션 추가'}
          </button>
        </div>
      </div>
    </div>
  )
}
