/**
 * Admin API — 강좌 검색 (course_picker 용).
 * 페이지 빌더의 featured_courses / company_collection 블록에서 사용.
 *
 * GET ?q=keyword&limit=20  → [{id, title, slug, thumbnail_url, status}]
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_guard'

export async function GET(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const q = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? 20))

  let query = supabase
    .from('courses')
    .select('id, title, slug, thumbnail_url, status')
    .order('updated_at', { ascending: false })
    .limit(limit)

  if (q) {
    query = query.ilike('title', `%${q}%`) as typeof query
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ courses: data ?? [] })
}
