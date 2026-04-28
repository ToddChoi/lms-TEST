import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * 강의 노트 — 로그인 사용자가 본인 노트만 다룹니다.
 *  GET    /api/notes?lessonId=...
 *  POST   /api/notes        body: { lessonId, courseId?, timestamp?, content }
 *  PUT    /api/notes        body: { id, content, timestamp? }
 *  DELETE /api/notes        body: { id }
 */

export async function GET(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const lessonId = searchParams.get('lessonId')
  const courseId = searchParams.get('courseId')

  let query = supabase
    .from('lesson_notes')
    .select('id, lesson_id, course_id, timestamp, content, created_at, updated_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (lessonId) query = query.eq('lesson_id', lessonId)
  else if (courseId) query = query.eq('course_id', courseId)

  const { data, error: dbError } = await query
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { lessonId, courseId, timestamp, content } = body as {
    lessonId: string; courseId?: string; timestamp?: number; content: string
  }
  if (!lessonId || !content?.trim()) {
    return NextResponse.json({ error: 'lessonId 와 content 는 필수입니다.' }, { status: 400 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error: dbError } = await (supabase as any)
    .from('lesson_notes')
    .insert({
      user_id: user.id,
      lesson_id: lessonId,
      course_id: courseId ?? null,
      timestamp: typeof timestamp === 'number' ? Math.max(0, Math.floor(timestamp)) : null,
      content: content.trim(),
    })
    .select('id, lesson_id, course_id, timestamp, content, created_at, updated_at')
    .single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { id, content, timestamp } = body as {
    id: string; content?: string; timestamp?: number | null
  }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof content === 'string') update.content = content.trim()
  if (timestamp !== undefined) {
    update.timestamp =
      typeof timestamp === 'number' ? Math.max(0, Math.floor(timestamp)) : null
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any)
    .from('lesson_notes')
    .update(update)
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { error, user, supabase } = await requireAuth()
  if (error) return error

  const body = await req.json()
  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: dbError } = await (supabase as any)
    .from('lesson_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
