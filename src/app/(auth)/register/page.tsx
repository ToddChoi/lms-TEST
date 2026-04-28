'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { BookOpen, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const registerSchema = z
  .object({
    name: z.string().min(2, '이름은 2자 이상이어야 합니다.').max(20, '이름은 20자 이하여야 합니다.'),
    email: z.string().email('올바른 이메일을 입력해주세요.'),
    password: z
      .string()
      .min(8, '비밀번호는 8자 이상이어야 합니다.')
      .regex(/[A-Za-z]/, '영문자를 포함해야 합니다.')
      .regex(/[0-9]/, '숫자를 포함해야 합니다.'),
    passwordConfirm: z.string(),
    phone: z.string().optional(),
    agreeTerms: z.boolean().refine((v) => v === true, '이용약관에 동의해주세요.'),
    agreePrivacy: z.boolean().refine((v) => v === true, '개인정보처리방침에 동의해주세요.'),
  })
  .refine((data) => data.password === data.passwordConfirm, {
    message: '비밀번호가 일치하지 않습니다.',
    path: ['passwordConfirm'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { agreeTerms: false, agreePrivacy: false },
  })

  const onSubmit = async (data: RegisterForm) => {
    setServerError(null)
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: { name: data.name, phone: data.phone || '' },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    })

    if (error) {
      if (error.message.includes('already registered')) {
        setServerError('이미 가입된 이메일입니다. 로그인해주세요.')
      } else {
        setServerError(error.message)
      }
      return
    }

    setSuccess(true)
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-silver px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
          <CheckCircle className="mx-auto h-16 w-16 text-green-500" />
          <h2 className="mt-4 text-xl font-bold text-navy">가입 완료!</h2>
          <p className="mt-2 text-sm text-gray-500">
            회원가입이 완료되었습니다.
            <br />
            로그인 페이지로 이동해주세요.
          </p>
          <Button
            onClick={() => router.push('/login')}
            className="mt-6 w-full"
            size="lg"
          >
            로그인하기
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-silver px-4 py-12">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="mb-8 flex flex-col items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-navy">Ingrow LMS</span>
          </Link>
          <h1 className="mt-6 text-2xl font-bold text-navy">회원가입</h1>
          <p className="mt-1 text-sm text-gray-500">Ingrow LMS와 함께 성장하세요</p>
        </div>

        {/* 폼 */}
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <Input
              label="이름"
              placeholder="홍길동"
              error={errors.name?.message}
              {...register('name')}
            />
            <Input
              label="이메일"
              type="email"
              placeholder="name@example.com"
              error={errors.email?.message}
              {...register('email')}
            />
            <Input
              label="연락처 (선택)"
              type="tel"
              placeholder="010-0000-0000"
              error={errors.phone?.message}
              {...register('phone')}
            />
            <Input
              label="비밀번호"
              type="password"
              placeholder="영문+숫자 8자 이상"
              error={errors.password?.message}
              hint="영문자와 숫자를 포함하여 8자 이상"
              {...register('password')}
            />
            <Input
              label="비밀번호 확인"
              type="password"
              placeholder="비밀번호 재입력"
              error={errors.passwordConfirm?.message}
              {...register('passwordConfirm')}
            />

            {/* 약관 동의 */}
            <div className="mt-2 flex flex-col gap-3 rounded-xl bg-silver p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent"
                  {...register('agreeTerms')}
                />
                <span className="text-sm text-gray-700">
                  <Link href="/terms" className="font-medium text-accent hover:underline" target="_blank">
                    이용약관
                  </Link>
                  에 동의합니다 <span className="text-red-400">(필수)</span>
                </span>
              </label>
              {errors.agreeTerms && (
                <p className="ml-7 text-xs text-red-500">{errors.agreeTerms.message}</p>
              )}

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 rounded border-gray-300 text-accent"
                  {...register('agreePrivacy')}
                />
                <span className="text-sm text-gray-700">
                  <Link href="/privacy" className="font-medium text-accent hover:underline" target="_blank">
                    개인정보처리방침
                  </Link>
                  에 동의합니다 <span className="text-red-400">(필수)</span>
                </span>
              </label>
              {errors.agreePrivacy && (
                <p className="ml-7 text-xs text-red-500">{errors.agreePrivacy.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
                {serverError}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              loading={isSubmitting}
              className="mt-2 w-full"
            >
              회원가입
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="font-medium text-accent hover:underline">
              로그인
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
