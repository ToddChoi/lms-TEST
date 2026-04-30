import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAuth } from '@/app/api/_guard'

/**
 * 강좌 수강평 — 누구나 GET, 수강생만 POST
 *  GET    /api/reviews?courseId=...
 *  POST   /api/reviews   { courseId, rating, content }
 *  PUT    /api/reviews   { id, rating?, content? }
 *  DELETE /api/reviews   { id }
 */

const MAX_LEN = 2000

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const courseId = searchParams.get('courseId')
  if (!courseId) return NextResponse.json({ error: 'courseId 필수' }, { status: 400 })

  const supabase = createClient()
  const { data, error } = await supabase
    .from('course_reviews')
    .select('id, course_id, user_id, rating, content, is_verified, helpful_count, created_at, updated_at, profiles!user_id (name, avatar_url)')
    .eq('course_id', courseId)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const { courseId, rating, content } = body as {
    courseId: string; rating: number; content: string
  }

  if (!courseId) return NextResponse.json({ error: 'courseId 필수' }, { status: 400 })
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return NextResponse.json({ error: '평점은 1~5 사이여야 합니다.' }, { status: 400 })
  if (!content?.trim() || content.length > MAX_LEN)
    return NextResponse.json({ error: `내용은 1~${MAX_LEN}자 사이여야 합니다.` }, { status: 400 })

  // 실수강생 확인 → is_verified
  const { data: rawEnrollment } = await supabase
    .from('enrollments').select('id, status')
    .eq('user_id', user.id).eq('course_id', courseId).maybeSingle()
  const enrollment = rawEnrollment as unknown as { status: string } | null
  const isVerified = !!enrollment && ['active', 'completed'].includes(enrollment.status)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('course_reviews')
    .insert({
      course_id: courseId,
      user_id: user.id,
      rating,
      content: content.trim(),
      is_verified: isVerified,
    })
    .select('id, course_id, user_id, rating, content, is_verified, helpful_count, created_at, updated_at')
    .single()

  if (error) {
    if (error.code === '23505')
      return NextResponse.json({ error: '이미 후기를 작성하셨습니다.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ data }, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const { id, rating, content } = body as { id: string; rating?: number; content?: string }
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (rating != null) {
    if (!Number.isInteger(rating) || rating < 1 || rating > 5)
      return NextResponse.json({ error: '평점 1~5' }, { status: 400 })
    update.rating = rating
  }
  if (typeof content === 'string') {
    if (!content.trim() || content.length > MAX_LEN)
      return NextResponse.json({ error: `내용 1~${MAX_LEN}자` }, { status: 400 })
    update.content = content.trim()
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('course_reviews').update(update)
    .eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const { error: authErr, user, supabase } = await requireAuth()
  if (authErr) return authErr

  const body = await req.json()
  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('course_reviews').delete()
    .eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
