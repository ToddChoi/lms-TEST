import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 통합 검색 (자동완성용 lite 응답).
 *  GET /api/search?q=...&limit=5
 *
 * 비로그인 사용자도 호출 가능. status='active' 강좌만 노출.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const limit = Math.min(20, Math.max(1, Number(searchParams.get('limit') ?? 5)))

  if (q.length < 1) {
    return NextResponse.json({ courses: [], categories: [], instructors: [] })
  }

  const supabase = createClient()
  const like = `%${q}%`

  const [{ data: rawCourses }, { data: rawCategories }, { data: rawInstructors }] =
    await Promise.all([
      supabase
        .from('courses')
        .select('id, title, thumbnail_url, categories(name)')
        .eq('status', 'active')
        .ilike('title', like)
        .order('enrolled_count', { ascending: false })
        .limit(limit),
      supabase
        .from('categories')
        .select('id, name, slug')
        .eq('is_visible', true)
        .ilike('name', like)
        .limit(3),
      supabase
        .from('profiles')
        .select('id, name, avatar_url')
        .in('role', ['instructor', 'admin', 'superadmin'])
        .ilike('name', like)
        .limit(3),
    ])

  return NextResponse.json({
    courses:     rawCourses     ?? [],
    categories:  rawCategories  ?? [],
    instructors: rawInstructors ?? [],
  })
}
