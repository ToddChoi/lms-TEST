import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '../_guard'

export async function POST(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { question, answer, category, sort_order, is_active } = body

  if (!question?.trim()) return NextResponse.json({ error: '질문을 입력하세요.' }, { status: 400 })
  if (!answer?.trim()) return NextResponse.json({ error: '답변을 입력하세요.' }, { status: 400 })

  const { data: rawFaq, error } = await (supabase as any)
    .from('faqs')
    .insert({
      question: question.trim(),
      answer: answer.trim(),
      category: category?.trim() || null,
      sort_order: sort_order ?? 0,
      is_active: is_active ?? true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ faq: rawFaq as unknown as object })
}

export async function PATCH(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id, question, answer, category, sort_order, is_active } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const updateData: Record<string, unknown> = {}
  if (question !== undefined) updateData.question = question
  if (answer !== undefined) updateData.answer = answer
  if (category !== undefined) updateData.category = category || null
  if (sort_order !== undefined) updateData.sort_order = sort_order
  if (is_active !== undefined) updateData.is_active = is_active

  const { error } = await (supabase as any)
    .from('faqs')
    .update(updateData)
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const { guard, supabase: sb } = await requireAdmin()
  if (guard) return guard
  const supabase = sb!

  const body = await req.json()
  const { id } = body

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('faqs')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
