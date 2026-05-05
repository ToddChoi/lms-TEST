'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Logo } from '@/components/brand/Logo'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const loginSchema = z.object({
  email: z.string().email('올바른 이메일을 입력해주세요.'),
  password: z.string().min(6, '비밀번호는 6자 이상이어야 합니다.'),
})

type LoginForm = z.infer<typeof loginSchema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/my'
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setServerError('이메일 또는 비밀번호가 올바르지 않습니다.')
      } else {
        setServerError(error.message)
      }
      return
    }

    router.push(redirectTo)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Input
        label="이메일"
        type="email"
        placeholder="name@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <div>
        <Input
          label="비밀번호"
          type="password"
          placeholder="비밀번호 입력"
          error={errors.password?.message}
          {...register('password')}
        />
        <div className="mt-1 text-right">
          <Link href="/forgot-password" className="text-xs text-accent hover:underline">
            비밀번호를 잊으셨나요?
          </Link>
        </div>
      </div>

      {serverError && (
        <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {serverError}
        </div>
      )}

      <Button type="submit" size="lg" loading={isSubmitting} className="mt-2 w-full">
        로그인
      </Button>
    </form>
  )
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-silver px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center text-navy">
            <Logo size="md" />
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-navy">로그인</h1>
          <p className="mt-1 text-sm text-gray-500">계속하려면 로그인하세요</p>
        </div>

        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-silver" />}>
            <LoginForm />
          </Suspense>

          <div className="mt-6 text-center text-sm text-gray-500">
            계정이 없으신가요?{' '}
            <Link href="/register" className="font-medium text-accent hover:underline">
              회원가입
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
