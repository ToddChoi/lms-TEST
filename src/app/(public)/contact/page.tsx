'use client'

import { useState } from 'react'
import { MessageSquare, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ContactPage() {
  const [form, setForm] = useState({
    name: '', email: '', phone: '', subject: '', message: '',
    privacyAgree: false,
    honeypot: '',
  })
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      setError('이름, 이메일, 문의 내용은 필수입니다.')
      return
    }
    if (!form.privacyAgree) {
      setError('개인정보 수집·이용 동의가 필요합니다.')
      return
    }
    setLoading(true)
    setError('')

    const res = await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        email: form.email,
        phone: form.phone,
        subject: form.subject,
        message: form.message,
        type: 'general',
        honeypot: form.honeypot,
      }),
    })

    setLoading(false)
    if (res.ok) {
      setSent(true)
    } else {
      const data = await res.json()
      setError(data.error ?? '전송에 실패했습니다. 다시 시도해주세요.')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-pale">
          <MessageSquare className="h-5 w-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-navy">이용 문의</h1>
          <p className="text-sm text-gray-500">궁금하신 점을 남겨주시면 빠르게 답변드립니다.</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-8 shadow-sm">
        {sent ? (
          <div className="flex flex-col items-center gap-4 py-8 text-center">
            <CheckCircle className="h-14 w-14 text-green-500" />
            <div>
              <p className="text-lg font-semibold text-navy">문의가 접수되었습니다</p>
              <p className="mt-2 text-sm text-gray-500">
                담당자가 검토 후 이메일로 답변드리겠습니다.
                <br />감사합니다.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="이름 *"
                placeholder="홍길동"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
              <Input
                label="이메일 *"
                type="email"
                placeholder="name@example.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="연락처"
                type="tel"
                placeholder="010-0000-0000"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
              <Input
                label="제목"
                placeholder="문의 제목"
                value={form.subject}
                onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">문의 내용 *</label>
              <textarea
                rows={6}
                placeholder="문의 내용을 자세히 적어주세요."
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent resize-none"
              />
            </div>

            {/* 스팸 봇 차단용 honeypot — 사람에겐 안 보이지만 봇은 채워서 식별됨 */}
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
            <Button type="submit" loading={loading} size="lg" className="mt-1">
              문의 보내기
            </Button>
          </form>
        )}
      </div>
    </div>
  )
}
