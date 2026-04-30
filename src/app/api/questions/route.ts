import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * 강좌 Q&A 질문 — 누구나 GET, 로그인 사용자만 POST
 *  GET  /api/questions?courseId=...
 *  POST /api/questions  { courseId, lessonId?, title, content }
 */

const MAX_TITLE = 200
const MAX_CONTENT = 5000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId 필수' }, { status: 400 })

  const supabase = createClient()
  const { data: rawQuestions, error } = await supabase
    .from('course_questions')
    .select('id, course_id, user_id, lesson_id, title, content, is_resolved, created_at, profiles!user_id (name, avatar_url)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 답변 카운트 / 답변 목록 합쳐서 반환
  const questionIds = (rawQuestions ?? []).map((q: { id: string }) => q.id)
  let answersByQ: Record<string, unknown[]> = {}
  if (questionIds.length > 0) {
    const { data: rawAnswers } = await supabase
      .from('course_answers')
      .select('id, question_id, user_id, content, is_instructor_answer, created_at, profiles!user_id (name, avatar_url)')
      .in('question_id', questionIds)
      .order('created_at', { ascending: true })
    answersByQ = ((rawAnswers as unknown as { question_id: string }[]) ?? [])
      .reduce<Record<string, unknown[]>>((acc, a) => {
        acc[a.question_id] = [...(acc[a.question_id] ?? []), a]
        return acc
      }, {})
  }

  const data = (rawQuestions ?? []).map((q) => ({
    ...(q as object),
    answers: answersByQ[(q as { id: string }).id] ?? [],
  }))
  return NextResponse.json({ data })
}

export async function POST(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const { courseId, lessonId, title, content } = body as {
    courseId: string; lessonId?: string | null; title: string; content: string
  }
  if (!courseId || !title?.trim() || !content?.trim())
    return NextResponse.json({ error: '필수 항목 누락' }, { status: 400 })
  if (title.length > MAX_TITLE || content.length > MAX_CONTENT)
    return NextResponse.json({ error: '글자수 초과' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('course_questions')
    .insert({
      course_id: courseId,
      user_id: user.id,
      lesson_id: lessonId ?? null,
      title: title.trim(),
      content: content.trim(),
    })
    .select('id, course_id, user_id, lesson_id, title, content, is_resolved, created_at')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}
