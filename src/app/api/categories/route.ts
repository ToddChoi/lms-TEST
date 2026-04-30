import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * 공개 카테고리 목록 — 메가메뉴/필터 자동완성에 사용.
 * 비로그인 가능. is_visible=true 만.
 */
export async function GET() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug, icon, sort_order')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data ?? [] })
}
