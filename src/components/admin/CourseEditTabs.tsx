'use client'

import { useState } from 'react'
import { CourseForm } from '@/components/courses/CourseForm'
import { CourseDetailForm } from '@/components/courses/CourseDetailForm'
import SectionManager, { type Section } from '@/components/admin/SectionManager'
import type { Category } from '@/types/database'
import { BookOpen, Settings, ListVideo } from 'lucide-react'

interface Props {
  course: Record<string, any>
  categories: Category[]
  sections: Section[]
}

const TABS = [
  { key: 'basic',      label: '기본 정보',   icon: Settings },
  { key: 'curriculum', label: '커리큘럼',    icon: ListVideo },
  { key: 'detail',     label: '상세 정보',   icon: BookOpen },
] as const

type TabKey = typeof TABS[number]['key']

export function CourseEditTabs({ course, categories, sections }: Props) {
  const [tab, setTab] = useState<TabKey>('basic')

  return (
    <div>
      {/* 탭 네비게이션 */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition ${
              tab === key
                ? 'border-[#2D7DD2] text-[#2D7DD2]'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      {tab === 'basic' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <CourseForm
            categories={categories}
            mode="edit"
            initialValues={{ ...course, id: course.id }}
          />
        </div>
      )}

      {tab === 'curriculum' && (
        <SectionManager courseId={course.id} initialSections={sections} />
      )}

      {tab === 'detail' && (
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <CourseDetailForm courseId={course.id} initialValues={course} />
        </div>
      )}
    </div>
  )
}
