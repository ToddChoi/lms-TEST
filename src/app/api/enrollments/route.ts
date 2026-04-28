import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { sendEmail } from '@/lib/email/send'
import { EnrollmentEmail } from '@/lib/email/templates/enrollment'

export async function POST(request: Request) {
  const cookieStore = cookies()

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  // 로그인 확인
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json()
  const { courseId } = body

  if (!courseId) {
    return NextResponse.json({ error: '강좌 ID가 필요합니다.' }, { status: 400 })
  }

  // 강좌 존재 및 active 확인
  const { data: rawCourse } = await supabase
    .from('courses')
    .select('id, price, enroll_start, enroll_end, learn_end')
    .eq('id', courseId)
    .eq('status', 'active')
    .single()
  const course = rawCourse as unknown as { id: string; price: number; enroll_start: string | null; enroll_end: string | null; learn_end: string | null } | null

  if (!course) {
    return NextResponse.json({ error: '존재하지 않거나 비활성 강좌입니다.' }, { status: 404 })
  }

  // 유료 강좌는 결제 플로우로 (Phase 6)
  if (course.price > 0) {
    return NextResponse.json({ error: '유료 강좌는 결제 후 수강 신청 가능합니다.' }, { status: 400 })
  }

  // 중복 신청 확인
  const { data: rawExisting } = await supabase
    .from('enrollments')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .maybeSingle()
  const existing = rawExisting as unknown as { id: string; status: string } | null

  if (existing) {
    if (existing.status === 'active') {
      return NextResponse.json({ error: '이미 수강 신청된 강좌입니다.' }, { status: 409 })
    }
    // 취소/만료 상태면 재활성화
    const { error } = await (supabase as any)
      .from('enrollments')
      .update({ status: 'active', enrolled_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (error) {
      return NextResponse.json({ error: '수강 신청 처리 중 오류가 발생했습니다.' }, { status: 500 })
    }
    return NextResponse.json({ success: true, reactivated: true })
  }

  // 신규 수강 신청
  const { data: enrollment, error } = await (supabase as any)
    .from('enrollments')
    .insert({
      user_id: user.id,
      course_id: courseId,
      status: 'active',
      expires_at: course.learn_end
        ? new Date(course.learn_end).toISOString()
        : null,
    })
    .select('id')
    .single()

  if (error) {
    return NextResponse.json({ error: '수강 신청에 실패했습니다.' }, { status: 500 })
  }

  // 수강 신청 완료 메일 (실패해도 응답엔 영향 없음)
  try {
    const { data: rawCourseInfo } = await supabase
      .from('courses').select('title').eq('id', courseId).single()
    const { data: rawProfile } = await supabase
      .from('profiles').select('name, email').eq('id', user.id).single()
    const courseInfo = rawCourseInfo as unknown as { title: string } | null
    const profile = rawProfile as unknown as { name: string | null; email: string | null } | null
    const recipient = profile?.email || user.email
    if (recipient && courseInfo) {
      await sendEmail({
        to: recipient,
        subject: `[Ingrow LMS] ${courseInfo.title} 수강 신청 완료`,
        react: EnrollmentEmail({
          name: profile?.name ?? null,
          courseTitle: courseInfo.title,
          courseId,
        }),
        template: 'enrollment',
        userId: user.id,
      })
    }
  } catch (e) {
    console.warn('[enrollment email] failed:', e)
  }

  return NextResponse.json({ success: true, enrollmentId: enrollment.id }, { status: 201 })
}
