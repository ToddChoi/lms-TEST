'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  createCompanyAction,
  updateCompanyAction,
} from '@/app/admin/companies/actions'

const schema = z.object({
  name: z.string().min(1, '기업명을 입력하세요.'),
  contact_name: z.string().optional(),
  contact_email: z.string().email('유효한 이메일을 입력하세요.').optional().or(z.literal('')),
  contract_start: z.string().optional(),
  contract_end: z.string().optional(),
  is_active: z.boolean().default(true),
})

export type CompanyFormValues = z.infer<typeof schema>

interface CompanyFormProps {
  initialValues?: Partial<CompanyFormValues> & { id?: string }
  mode: 'create' | 'edit'
}

/**
 * Phase C2 — react-hook-form + Server Action 하이브리드 패턴.
 * - client validation: zodResolver (즉시 피드백)
 * - mutation: useTransition + Server Action 직접 호출 (form action 대신 imperative)
 * - useFormState 미사용 — react-hook-form 의 handleSubmit 가 onSubmit 책임
 */
export function CompanyForm({ initialValues, mode }: CompanyFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, formState: { errors } } = useForm<CompanyFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialValues?.name ?? '',
      contact_name: initialValues?.contact_name ?? '',
      contact_email: initialValues?.contact_email ?? '',
      contract_start: initialValues?.contract_start ?? '',
      contract_end: initialValues?.contract_end ?? '',
      is_active: initialValues?.is_active ?? true,
    },
  })

  const onSubmit = (values: CompanyFormValues) => {
    setError(null)
    startTransition(async () => {
      const input = {
        name: values.name,
        contact_name: values.contact_name || null,
        contact_email: values.contact_email || null,
        contract_start: values.contract_start || null,
        contract_end: values.contract_end || null,
        is_active: values.is_active,
      }
      const result =
        mode === 'create'
          ? await createCompanyAction(input)
          : await updateCompanyAction(initialValues!.id!, input)

      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/companies')
    })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm font-medium text-[#0B1F3A] mb-1">기업명 *</label>
        <input
          {...register('name')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A] mb-1">담당자 이름</label>
        <input
          {...register('contact_name')}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-[#0B1F3A] mb-1">담당자 이메일</label>
        <input
          {...register('contact_email')}
          type="email"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
        />
        {errors.contact_email && <p className="text-xs text-red-500 mt-1">{errors.contact_email.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A] mb-1">계약 시작일</label>
          <input
            {...register('contract_start')}
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-[#0B1F3A] mb-1">계약 종료일</label>
          <input
            {...register('contract_end')}
            type="date"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2D7DD2]"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[#0B1F3A]">
        <input type="checkbox" {...register('is_active')} className="rounded" />
        활성 상태
      </label>

      {error && <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 text-sm">{error}</div>}

      <div className="flex gap-2 mt-2">
        <button
          type="submit"
          disabled={isPending}
          className="bg-[#2D7DD2] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#2566b0] transition disabled:opacity-50"
        >
          {isPending ? '저장 중...' : mode === 'create' ? '등록' : '저장'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/admin/companies')}
          className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50 transition"
        >
          취소
        </button>
      </div>
    </form>
  )
}
