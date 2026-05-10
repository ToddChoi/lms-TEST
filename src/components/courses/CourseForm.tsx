'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { RichEditor } from '@/components/ui/RichEditor'
import { createClient } from '@/lib/supabase/client'
import type { Category } from '@/types/database'

const schema = z.object({
  title: z.string().min(2, '강좌명은 2자 이상이어야 합니다.'),
  slug: z.string().min(2, 'URL 슬러그는 2자 이상이어야 합니다.').regex(/^[a-z0-9-]+$/, '영문 소문자, 숫자, 하이픈만 사용 가능합니다.'),
  description: z.string().optional(),
  category_id: z.coerce.number().optional(),
  price: z.coerce.number().min(0).default(0),
  enroll_start: z.string().optional(),
  enroll_end: z.string().optional(),
  learn_start: z.string().optional(),
  learn_end: z.string().optional(),
  review_days: z.coerce.number().min(0).default(0),
  level: z.enum(['all', 'beginner', 'intermediate', 'advanced']).default('all'),
  status: z.enum(['draft', 'active', 'closed']).default('draft'),
  is_featured: z.boolean().default(false),
  thumbnail_url: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface CourseFormProps {
  categories: Category[]
  initialValues?: Partial<FormValues> & { id?: string }
  mode: 'create' | 'edit'
}

export function CourseForm({ categories, initialValues, mode }: CourseFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [thumbPreview, setThumbPreview] = useState<string>(initialValues?.thumbnail_url ?? '')
  const supabase = createClient()

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: initialValues?.title ?? '',
      slug: initialValues?.slug ?? '',
      description: initialValues?.description ?? '',
      price: initialValues?.price ?? 0,
      level: initialValues?.level ?? 'all',
      status: initialValues?.status ?? 'draft',
      is_featured: initialValues?.is_featured ?? false,
      ...initialValues,
    },
  })

  const autoSlug = (title: string) =>
    title.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')

  const onSubmit = async (values: FormValues) => {
    setLoading(true)
    setError(null)

    try {
      const sb = supabase as any
      const payload = {
        ...values,
        category_id: values.category_id || null,
        enroll_start: values.enroll_start || null,
        enroll_end: values.enroll_end || null,
        learn_start: values.learn_start || null,
        learn_end: values.learn_end || null,
        thumbnail_url: values.thumbnail_url || null,
      }
      if (mode === 'create') {
        const { error } = await sb.from('courses').insert(payload)
        if (error) throw error
        router.push('/admin/courses')
      } else {
        const { error } = await sb.from('courses').update(payload).eq('id', initialValues!.id!)
        if (error) throw error
      }
      router.refresh()
      if (mode === 'create') router.push('/admin/courses')
    } catch (e: any) {
      setError(e.message || '저장 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) => (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )

  const inputCls = "rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>
      )}

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <Field label="강좌명 *" error={errors.title?.message}>
          <input
            {...register('title')}
            className={inputCls}
            placeholder="강좌명을 입력하세요"
            onChange={(e) => {
              register('title').onChange(e)
              if (mode === 'create') setValue('slug', autoSlug(e.target.value))
            }}
          />
        </Field>

        <Field label="URL 슬러그 *" error={errors.slug?.message}>
          <input {...register('slug')} className={inputCls} placeholder="url-slug" />
        </Field>

        <Field label="카테고리">
          <select {...register('category_id')} className={inputCls}>
            <option value="">카테고리 선택</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </Field>

        <Field label="가격 (원, 0 = 무료)" error={errors.price?.message}>
          <input {...register('price')} type="number" min={0} className={inputCls} placeholder="0" />
        </Field>

        <Field label="수강 신청 시작일">
          <input {...register('enroll_start')} type="date" className={inputCls} />
        </Field>

        <Field label="수강 신청 마감일">
          <input {...register('enroll_end')} type="date" className={inputCls} />
        </Field>

        <Field label="학습 시작일">
          <input {...register('learn_start')} type="date" className={inputCls} />
        </Field>

        <Field label="학습 종료일">
          <input {...register('learn_end')} type="date" className={inputCls} />
        </Field>

        <Field label="난이도">
          <select {...register('level')} className={inputCls}>
            <option value="all">전체</option>
            <option value="beginner">입문</option>
            <option value="intermediate">중급</option>
            <option value="advanced">고급</option>
          </select>
        </Field>

        <Field label="상태">
          <select {...register('status')} className={inputCls}>
            <option value="draft">초안 (비공개)</option>
            <option value="active">공개</option>
            <option value="closed">마감</option>
          </select>
        </Field>
      </div>

      <Field label="강좌 소개">
        <RichEditor
          value={watch('description') ?? ''}
          onChange={(html) => setValue('description', html, { shouldDirty: true })}
          placeholder="강좌를 소개하는 내용을 입력하세요. 수강생이 이 강좌를 선택해야 하는 이유를 설명해주세요."
        />
      </Field>

      {/* 썸네일 URL + 미리보기 */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">썸네일 URL</label>
        <div className="flex gap-4 items-start">
          <div className="flex-1 flex flex-col gap-2">
            <input
              {...register('thumbnail_url')}
              className={inputCls}
              placeholder="https://images.unsplash.com/..."
              onChange={(e) => {
                register('thumbnail_url').onChange(e)
                setThumbPreview(e.target.value)
              }}
            />
            <p className="text-xs text-gray-400">
              Unsplash, Imgur 등 외부 이미지 URL을 입력하세요. 권장 비율: 16:9 (640×360px)
            </p>
          </div>
          {thumbPreview && (
            <div className="w-40 h-24 rounded-lg overflow-hidden border border-gray-200 flex-shrink-0 bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumbPreview}
                alt="썸네일 미리보기"
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input {...register('is_featured')} type="checkbox" id="is_featured" className="h-4 w-4 rounded accent-accent" />
        <label htmlFor="is_featured" className="text-sm text-gray-700">메인 추천 강좌로 설정</label>
      </div>

      <div className="flex justify-end gap-3 border-t border-gray-100 pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          취소
        </Button>
        <Button type="submit" loading={loading}>
          {mode === 'create' ? '강좌 추가' : '변경 저장'}
        </Button>
      </div>
    </form>
  )
}
