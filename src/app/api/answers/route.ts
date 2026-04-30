import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * Q&A 답변 — 로그인 사용자만 POST
 *  POST /api/answers  { questionId, content }
 *  강사/관리자가 단 답변은 자동으로 is_instructor_answer=true 마킹.
 */

const MAX_LEN = 5000

export async function POST(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const { questionId, content } = body as { questionId: string; content: string }
  if (!questionId || !content?.trim())
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  if (content.length > MAX_LEN)
    return NextResponse.json({ error: '글자수 초과' }, { status: 400 })

  // 답변자 역할 확인 + 해당 강좌의 강사인지 확인 (is_instructor_answer 자동 마킹)
  const { data: rawProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  const role = (rawProfile as unknown as { role: string } | null)?.role
  const isAdmin = role === 'admin' || role === 'superadmin'

  let isInstructorAnswer = isAdmin
  if (!isAdmin && role === 'instructor') {
    // 질문이 속한 강좌의 instructor_id == user.id 인 경우만
    const { data: rawQ } = await supabase
      .from('course_questions').select('course_id').eq('id', questionId).maybeSingle()
    const courseId = (rawQ as unknown as { course_id: string } | null)?.course_id
    if (courseId) {
      const { data: rawCourse } = await supabase
        .from('courses').select('instructor_id').eq('id', courseId).maybeSingle()
      const instructorId = (rawCourse as unknown as { instructor_id: string | null } | null)?.instructor_id
      if (instructorId === user.id) isInstructorAnswer = true
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('course_answers')
    .insert({
      question_id: questionId,
      user_id: user.id,
      content: content.trim(),
      is_instructor_answer: isInstructorAnswer,
    })
    .select('id, question_id, user_id, content, is_instructor_answer, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
