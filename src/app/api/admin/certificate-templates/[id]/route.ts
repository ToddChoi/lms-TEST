/**
 * 수료증 템플릿 단건 조회 — 편집기 페이지에서 사용.
 */
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../_guard'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const { data, error } = await supabase
    .from('certificate_templates')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json({ template: data })
}
