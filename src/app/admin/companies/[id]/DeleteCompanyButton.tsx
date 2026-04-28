'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteCompanyButton({ companyId }: { companyId: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const onDelete = async () => {
    if (!confirm('이 기업을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    setLoading(true)
    try {
      const res = await fetch('/api/admin/companies', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: companyId }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        alert(d.error ?? '삭제에 실패했습니다.')
        return
      }
      router.push('/admin/companies')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      className="bg-red-50 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm hover:bg-red-100 transition disabled:opacity-50"
    >
      {loading ? '삭제 중...' : '기업 삭제'}
    </button>
  )
}
