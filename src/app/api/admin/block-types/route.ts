/**
 * Admin API — block_types 조회.
 * fields JSON 을 admin UI 가 읽어 동적 폼 렌더.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function GET() {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { data, error } = await supabase
    .from('block_types')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ types: data ?? [] })
}
