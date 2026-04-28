import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { requireAdmin } from '../../_guard'

const DEFAULT_CONFIGS: Record<string, object> = {
  hero:             { heading: '', subheading: '', cta_label: '강좌 둘러보기', cta_url: '/courses', cta_secondary_label: '기업 도입 문의', cta_secondary_url: '/b2b' },
  banner:           { autoplay: true, interval: 5000, show_arrows: true, show_dots: true },
  featured_courses: { limit: 6, filter: 'is_featured', title: '추천 강좌', subtitle: '지금 인기 있는 강좌를 만나보세요' },
  categories:       { limit: 8, title: '카테고리' },
  stats:            { show_students: true, show_courses: true, show_companies: true },
  custom_html:      { html: '' },
}

export async function GET(_req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const { data, error } = await supabase!
    .from('home_sections')
    .select('*')
    .order('sort_order')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ sections: data })
}

export async function POST(req: NextRequest) {
  const { guard, supabase } = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { type, label } = body

  if (!type?.trim()) return NextResponse.json({ error: 'type은 필수입니다.' }, { status: 400 })
  if (!label?.trim()) return NextResponse.json({ error: 'label은 필수입니다.' }, { status: 400 })

  // 현재 최대 sort_order 조회
  const { data: maxRow } = await supabase!
    .from('home_sections')
    .select('sort_order')
    .order('sort_order', { ascending: false })
    .limit(1)
    .single()

  const nextOrder = ((maxRow as any)?.sort_order ?? 0) + 1
  const config = DEFAULT_CONFIGS[type] ?? {}

  const { data, error } = await supabase!
    .from('home_sections')
    .insert({ type, label, sort_order: nextOrder, config, is_visible: true })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  revalidatePath('/')
  return NextResponse.json({ section: data }, { status: 201 })
}
