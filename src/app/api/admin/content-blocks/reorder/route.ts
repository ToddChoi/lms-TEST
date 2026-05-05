/**
 * 블록 순서 일괄 변경 — drag&drop 후 호출.
 * body: { ids: string[] }  ←  새 순서대로
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../../_guard'

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { ids } = await req.json() as { ids?: string[] }
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids 배열 필요' }, { status: 400 })
  }

  // i*10 으로 간격 두고 sort 업데이트 — 다음에 끼워넣을 여유.
  const updates = ids.map((id, i) => ({ id, sort_order: (i + 1) * 10 }))
  for (const u of updates) {
    const { error } = await (supabase as any)
      .from('content_blocks')
      .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
      .eq('id', u.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
