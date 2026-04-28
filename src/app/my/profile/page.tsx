'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Lock, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export default function ProfilePage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [savingName, setSavingName] = useState(false)
  const [savingPw, setSavingPw] = useState(false)
  const [nameToast, setNameToast] = useState('')
  const [pwToast, setPwToast] = useState('')
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [pwError, setPwError] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      setEmail(user.email ?? '')
      supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          if (data) setName((data as any).name ?? '')
          setLoading(false)
        })
    })
  }, [])

  function showToast(setter: (v: string) => void, msg: string) {
    setter(msg)
    setTimeout(() => setter(''), 3000)
  }

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSavingName(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim() })
      .eq('id', user.id)
    setSavingName(false)
    if (error) showToast(setNameToast, '저장 실패: ' + error.message)
    else showToast(setNameToast, '이름이 변경되었습니다.')
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    setPwError('')
    if (pwForm.next.length < 6) {
      setPwError('새 비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      setPwError('새 비밀번호가 일치하지 않습니다.')
      return
    }
    setSavingPw(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: pwForm.next })
    setSavingPw(false)
    if (error) {
      setPwError(error.message)
    } else {
      setPwForm({ current: '', next: '', confirm: '' })
      showToast(setPwToast, '비밀번호가 변경되었습니다.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="max-w-lg flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">프로필 설정</h1>
        <p className="mt-1 text-sm text-gray-500">이름과 비밀번호를 변경할 수 있습니다.</p>
      </div>

      {/* 이름 변경 */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-navy">기본 정보</h2>
        </div>
        <form onSubmit={handleSaveName} className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1 block">이메일</label>
            <input
              value={email}
              disabled
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-400"
            />
            <p className="mt-1 text-xs text-gray-400">이메일은 변경할 수 없습니다.</p>
          </div>
          <Input
            label="이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력하세요"
          />
          {nameToast && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" /> {nameToast}
            </div>
          )}
          <Button type="submit" loading={savingName}>
            이름 저장
          </Button>
        </form>
      </div>

      {/* 비밀번호 변경 */}
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <Lock className="h-4 w-4 text-accent" />
          <h2 className="font-semibold text-navy">비밀번호 변경</h2>
        </div>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <Input
            label="새 비밀번호"
            type="password"
            placeholder="6자 이상"
            value={pwForm.next}
            onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))}
          />
          <Input
            label="새 비밀번호 확인"
            type="password"
            placeholder="새 비밀번호 재입력"
            value={pwForm.confirm}
            onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))}
          />
          {pwError && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{pwError}</div>
          )}
          {pwToast && (
            <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" /> {pwToast}
            </div>
          )}
          <Button type="submit" loading={savingPw}>
            비밀번호 변경
          </Button>
        </form>
      </div>
    </div>
  )
}
