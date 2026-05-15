'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCompanyAction } from '@/app/admin/companies/actions'

export function DeleteCompanyButton({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const onDelete = () => {
    if (!confirm('이 기업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setError(null)
    startTransition(async () => {
      const result = await deleteCompanyAction(companyId)
      if (!result.ok) {
        setError(result.error)
        return
      }
      router.push('/admin/companies')
    })
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        onClick={onDelete}
        disabled={isPending}
        className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-100 transition disabled:opacity-50"
      >
        {isPending ? '삭제 중...' : '기업 삭제'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
