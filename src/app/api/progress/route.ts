import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'
import { sendEmail } from '@/lib/email/send'
import { CompletionEmail } from '@/lib/email/templates/completion'
import { CertificateEmail } from '@/lib/email/templates/certificate'

const COMPLETION_THRESHOLD = 0.8 // 80% 이상이면 강좌 수료

export async function POST(request: Request) {
  const cookieStore = cookies()
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: { name: string; value: string; options?: any }[]) => {
          try { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } catch {}
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = await request.json()
  const { lessonId, courseId, watchedSeconds, isCompleted } = body

  if (!lessonId || !courseId) {
    return NextResponse.json({ error: '필수 파라미터가 누락됐습니다.' }, { status: 400 })
  }

  // 수강 여부 확인
  const { data: rawEnrollment } = await supabase
    .from('enrollments').select('id, status').eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
  const enrollment = rawEnrollment as unknown as { id: string; status: string } | null
  if (!enrollment || enrollment.status !== 'active') {
    return NextResponse.json({ error: '수강 중인 강좌가 아닙니다.' }, { status: 403 })
  }

  // lesson_progress upsert
  const { error: upsertError } = await (supabase as any)
    .from('lesson_progress')
    .upsert({
      user_id: user.id,
      lesson_id: lessonId,
      course_id: courseId,
      watched_seconds: watchedSeconds ?? 0,
      is_completed: isCompleted ?? false,
      last_watched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lesson_id' })

  if (upsertError) {
    return NextResponse.json({ error: '진도 저장 실패' }, { status: 500 })
  }

  // 강좌 수료 여부 계산
  let courseCompleted = false
  if (isCompleted) {
    const [{ data: rawAllLessons }, { data: rawCompleted }] = await Promise.all([
      supabase.from('lessons').select('id').eq('course_id', courseId),
      supabase.from('lesson_progress').select('id').eq('user_id', user.id).eq('course_id', courseId).eq('is_completed', true),
    ])
    const allLessons = rawAllLessons as unknown as { id: string }[] | null
    const completedLessons = rawCompleted as unknown as { id: string }[] | null

    const total = allLessons?.length ?? 0
    const done = completedLessons?.length ?? 0
    const rate = total > 0 ? done / total : 0

    if (rate >= COMPLETION_THRESHOLD) {
      // ★ idempotent flip: status='active' 인 row 만 업데이트.
      // 동시 두 요청이 들어와도 UPDATE 가 row 를 잡는 쪽이 정확히 하나 → 메일 1회만 발송.
      const { data: rawFlipped } = await (supabase as any)
        .from('enrollments')
        .update({ status: 'completed' })
        .eq('id', enrollment.id)
        .eq('status', 'active')
        .select('id')
        .maybeSingle()
      const flippedByUs = !!(rawFlipped as { id: string } | null)

      courseCompleted = true

      // 수료증 발급 — UNIQUE(user_id, course_id) 제약 + onConflict 로 race-safe.
      // 신규 발급한 row 만 select 로 돌아옴 (ignoreDuplicates=true → 충돌 시 0건).
      const today = new Date()
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
      const certNumber = `CERT-${dateStr}-${rand}`

      const { data: rawNewCert } = await (supabase as any)
        .from('certificates')
        .upsert(
          { user_id: user.id, course_id: courseId, cert_number: certNumber },
          { onConflict: 'user_id,course_id', ignoreDuplicates: true }
        )
        .select('id')
        .maybeSingle()
      const newCertId = (rawNewCert as { id: string } | null)?.id ?? null

      // 메일은 우리가 flip 한 경우에만. 다른 동시 요청이 이미 보냈다면 skip.
      if (!flippedByUs) {
        return NextResponse.json({ success: true, courseCompleted })
      }

      try {
        const { data: rawCourseInfo } = await supabase
          .from('courses').select('title').eq('id', courseId).single()
        const { data: rawProfile } = await supabase
          .from('profiles').select('name, email').eq('id', user.id).single()
        const courseInfo = rawCourseInfo as unknown as { title: string } | null
        const profile = rawProfile as unknown as { name: string | null; email: string | null } | null
        const recipient = profile?.email || user.email

        if (recipient && courseInfo) {
          // 1) 수료 안내
          await sendEmail({
            to: recipient,
            subject: `[Ingrow LMS] ${courseInfo.title} 강좌 수료를 축하합니다`,
            react: CompletionEmail({
              name: profile?.name ?? null,
              courseTitle: courseInfo.title,
              courseId,
            }),
            template: 'completion',
            userId: user.id,
          })

          // 2) 신규 수료증 발급된 경우 수료증 안내
          if (newCertId) {
            await sendEmail({
              to: recipient,
              subject: `[Ingrow LMS] ${courseInfo.title} 수료증이 발급되었습니다`,
              react: CertificateEmail({
                name: profile?.name ?? null,
                courseTitle: courseInfo.title,
                certificateId: newCertId,
              }),
              template: 'certificate',
              userId: user.id,
            })
          }
        }
      } catch (e) {
        console.warn('[completion email] failed:', e)
      }
    }
  }

  return NextResponse.json({ success: true, courseCompleted })
}
