'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, X, Save } from 'lucide-react'

interface Props {
  courseId: string
  initialValues: Record<string, any>
}

export function CourseDetailForm({ courseId, initialValues }: Props) {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [whatYouLearn, setWhatYouLearn] = useState<string[]>(
    initialValues.what_you_learn ?? []
  )
  const [requirements, setRequirements] = useState<string[]>(
    initialValues.requirements ?? []
  )
  const [targetAudience, setTargetAudience] = useState<string>(
    initialValues.target_audience ?? ''
  )
  const [instructorName, setInstructorName] = useState<string>(
    initialValues.instructor_name ?? ''
  )
  const [instructorBio, setInstructorBio] = useState<string>(
    initialValues.instructor_bio ?? ''
  )

  // ── 배열 필드 헬퍼 ──────────────────────────────
  function addItem(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    setter((prev) => [...prev, ''])
  }
  function updateItem(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number,
    val: string
  ) {
    setter((prev) => prev.map((v, i) => (i === idx ? val : v)))
  }
  function removeItem(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    idx: number
  ) {
    setter((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSave() {
    setLoading(true)
    setError(null)
    setSuccess(false)

    const filtered = (arr: string[]) => arr.map((s) => s.trim()).filter(Boolean)

    const { error: err } = await (supabase as any).from('courses').update({
      what_you_learn:  filtered(whatYouLearn),
      requirements:    filtered(requirements),
      target_audience: targetAudience.trim() || null,
      instructor_name: instructorName.trim() || null,
      instructor_bio:  instructorBio.trim() || null,
    }).eq('id', courseId)

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccess(true)
      router.refresh()
      setTimeout(() => setSuccess(false), 3000)
    }
  }

  const inputCls =
    'w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-[#2D7DD2] focus:outline-none focus:ring-1 focus:ring-[#2D7DD2]'

  const SectionTitle = ({ children }: { children: React.ReactNode }) => (
    <h3 className="font-semibold text-[#0B1F3A] text-sm mb-3">{children}</h3>
  )

  const ArrayField = ({
    title,
    placeholder,
    items,
    setter,
  }: {
    title: string
    placeholder: string
    items: string[]
    setter: React.Dispatch<React.SetStateAction<string[]>>
  }) => (
    <div>
      <SectionTitle>{title}</SectionTitle>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <span className="text-gray-400 text-sm w-5 text-center">{idx + 1}</span>
            <input
              value={item}
              onChange={(e) => updateItem(setter, idx, e.target.value)}
              placeholder={placeholder}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => removeItem(setter, idx)}
              className="text-gray-400 hover:text-red-500 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => addItem(setter)}
        className="mt-2 flex items-center gap-1 text-[#2D7DD2] hover:text-[#2566b0] text-sm font-medium transition"
      >
        <Plus className="w-4 h-4" /> 항목 추가
      </button>
    </div>
  )

  return (
    <div className="flex flex-col gap-8">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}
      {success && (
        <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-600">
          ✓ 저장되었습니다.
        </div>
      )}

      {/* 학습 목표 */}
      <ArrayField
        title="이 강좌에서 배울 수 있는 것"
        placeholder="예: ChatGPT 프롬프트 작성 원리를 이해하고 활용할 수 있다"
        items={whatYouLearn}
        setter={setWhatYouLearn}
      />

      <hr className="border-gray-100" />

      {/* 사전 요구사항 */}
      <ArrayField
        title="수강 전 필요한 사전 지식"
        placeholder="예: 기본적인 컴퓨터 사용 능력"
        items={requirements}
        setter={setRequirements}
      />

      <hr className="border-gray-100" />

      {/* 수강 대상 */}
      <div>
        <SectionTitle>수강 대상</SectionTitle>
        <textarea
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
          rows={3}
          placeholder="예: AI 도구를 업무에 활용하고 싶은 직장인, 생산성을 높이고 싶은 사람"
          className={inputCls}
        />
      </div>

      <hr className="border-gray-100" />

      {/* 강사 정보 */}
      <div className="flex flex-col gap-4">
        <SectionTitle>강사 정보</SectionTitle>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">강사명</label>
          <input
            value={instructorName}
            onChange={(e) => setInstructorName(e.target.value)}
            placeholder="강사 이름"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">강사 소개</label>
          <textarea
            value={instructorBio}
            onChange={(e) => setInstructorBio(e.target.value)}
            rows={4}
            placeholder="강사 경력, 전문 분야 등을 입력하세요"
            className={inputCls}
          />
        </div>
      </div>

      {/* 저장 버튼 */}
      <div className="flex justify-end border-t border-gray-100 pt-5">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 bg-[#2D7DD2] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#2566b0] disabled:opacity-60 transition"
        >
          <Save className="w-4 h-4" />
          {loading ? '저장 중...' : '변경 저장'}
        </button>
      </div>
    </div>
  )
}
