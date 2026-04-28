'use client'

import { useState } from 'react'
import { Building2, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function B2BContactForm() {
  const [form, setForm] = useState({
    company: '', name: '', email: '', phone: '',
    headcount: '', subject: '', message: '',
    privacyAgree: false,
    honeypot: '',
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company || !form.name || !form.email || !form.message) {
      setError('회사명·이름·이메일·문의 내용은 필수입니다.')
      return
    }
    if (!form.privacyAgree) {
      setError('개인정보 수집·이용 동의가 필요합니다.')
      return
    }
    setLoading(true)
    setError('')

    // 인원수 정보는 문의 내용 뒤에 합쳐서 전송 (별도 컬럼 없음)
    const composedMessage = form.headcount
      ? `${form.message}\n\n[예상 인원] ${form.headcount}`
      : form.message

    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'b2b',
        name: form.name,
        email: form.email,
        phone: form.phone,
        company: form.company,
        subject: form.subject || `[B2B] ${form.company} 도입 문의`,
        message: composedMessage,
        honeypot: form.honeypot,
      }),
    })

    setLoading(false)
    if (res.ok) setSent(true)
    else {
      const data = await res.json()
      setError(data.error ?? '전송에 실패했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-5 flex items-center gap-2 text-navy">
        <Building2 className="h-5 w-5 text-accent" />
        <h3 className="text-lg font-bold">기업 도입 상담 신청</h3>
      </div>

      {sent ? (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <p className="text-base font-semibold text-navy">상담 신청이 접수되었습니다</p>
          <p className="text-sm text-gray-500">
            영업일 기준 1~2일 내 담당자가 연락드립니다.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="회사명 *"
              placeholder="(주)인그로우"
              value={form.company}
              onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
            />
            <Input
              label="담당자 이름 *"
              placeholder="홍길동"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="이메일 *"
              type="email"
              placeholder="name@company.com"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Input
              label="연락처"
              type="tel"
              placeholder="02-0000-0000"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="예상 인원수"
              placeholder="예: 50명"
              value={form.headcount}
              onChange={(e) => setForm((f) => ({ ...f, headcount: e.target.value }))}
            />
            <Input
              label="제목"
              placeholder="문의 제목 (선택)"
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              문의 내용 *
            </label>
            <textarea
              rows={5}
              placeholder="도입 목적, 관심 강좌, 시점 등 자유롭게 적어주세요."
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
            />
          </div>

          {/* honeypot */}
          <input
            type="text"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            value={form.honeypot}
            onChange={(e) => setForm((f) => ({ ...f, honeypot: e.target.value }))}
            className="hidden"
          />

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={form.privacyAgree}
              onChange={(e) => setForm((f) => ({ ...f, privacyAgree: e.target.checked }))}
              className="h-4 w-4 accent-accent"
            />
            개인정보 수집·이용에 동의합니다 (필수)
          </label>

          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
          )}
          <Button type="submit" loading={loading} size="lg" className="mt-1 bg-accent hover:bg-accent-light">
            상담 신청하기
          </Button>
        </form>
      )}
    </div>
  )
}
