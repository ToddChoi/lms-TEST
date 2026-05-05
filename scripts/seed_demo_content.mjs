/**
 * 시연 콘텐츠 보강 시드
 *  - 카테고리 오염("아아아", "이이이이") 정리
 *  - 강좌 8개에 Unsplash 무료 이미지 썸네일 매핑
 *  - 홈 배너 2개
 *  - 공지사항 3개
 *  - FAQ 5개
 *
 * seed_demo_personas.mjs 가 먼저 실행되어 강좌가 있어야 함.
 */

import { sb } from './_env.mjs'

const sb = createClient(
  'https://unrhoadjtyyuqvtdeyks.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0',
  { auth: { autoRefreshToken: false, persistSession: false } }
)

console.log('═══════════════════════════════════════════')
console.log('  Demo Content Seed')
console.log('═══════════════════════════════════════════\n')

// ════════════════════════════════════════════════════
// 1. 카테고리 오염 제거
// ════════════════════════════════════════════════════
console.log('[1/5] 카테고리 정리...')
const POLLUTED = ['아아아', '이이이이']
for (const name of POLLUTED) {
  const { error } = await sb.from('categories').delete().eq('name', name)
  if (error) console.error(`  ✗ ${name}: ${error.message}`)
  else console.log(`  ✓ deleted "${name}"`)
}

// ════════════════════════════════════════════════════
// 2. 강좌 썸네일 매핑 (Unsplash 무료 이미지)
// ════════════════════════════════════════════════════
console.log('\n[2/5] 강좌 썸네일...')
const THUMBS = {
  'demo-sql-basics':     'https://images.unsplash.com/photo-1544383835-bda2bc66a55d?w=800&q=80',     // database
  'demo-python-data':    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80',     // data analytics
  'demo-marketing-101':  'https://images.unsplash.com/photo-1432888622747-4eb9a8efeb07?w=800&q=80',  // marketing
  'demo-perf-marketing': 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80',  // performance
  'demo-react-intro':    'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80',  // react/code
  'demo-typescript-real':'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=80',     // code
  'demo-chatgpt-work':   'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&q=80',  // AI
  'demo-onboarding':     'https://images.unsplash.com/photo-1521737711867-e3b97375f902?w=800&q=80',  // team
}
let thumbCount = 0
for (const [slug, url] of Object.entries(THUMBS)) {
  const { data, error } = await sb.from('courses').update({ thumbnail_url: url }).eq('slug', slug).select('id')
  if (error) console.error(`  ✗ ${slug}: ${error.message}`)
  else if (data && data.length > 0) { thumbCount++; console.log(`  ✓ ${slug}`) }
  else console.log(`  · ${slug} (강좌 없음)`)
}
console.log(`  ${thumbCount}/${Object.keys(THUMBS).length} 매핑 완료`)

// ════════════════════════════════════════════════════
// 3. 홈 배너 2개
// ════════════════════════════════════════════════════
console.log('\n[3/5] 홈 배너...')
// banner 타입 home_section 찾기 (CMS v2 마이그레이션에서 기본 생성됨)
let { data: bannerSection } = await sb
  .from('home_sections').select('id').eq('type', 'banner').maybeSingle()

if (!bannerSection) {
  console.log('  ! banner 타입 home_section 없음 — 새로 생성')
  const { data: newSec, error } = await sb.from('home_sections').insert({
    type: 'banner', label: '홈 배너', sort_order: 1, is_visible: true,
    config: { autoplay: true, interval: 5000, show_arrows: true, show_dots: true },
  }).select('id').single()
  if (error || !newSec) {
    console.error(`  ✗ section 생성 실패: ${error?.message}`)
  } else {
    bannerSection = newSec
  }
}

if (bannerSection) {
  const banners = [
    {
      title: '신규 회원 환영! 무료 강좌 둘러보기',
      image_url: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=1600&q=80',
      link_url: '/courses?price=free',
      link_target: '_self',
      sort_order: 1,
      is_visible: true,
    },
    {
      title: '기업 도입 문의 — 단체 학습 프로그램',
      image_url: 'https://images.unsplash.com/photo-1556761175-5973dc0f32e7?w=1600&q=80',
      link_url: '/b2b',
      link_target: '_self',
      sort_order: 2,
      is_visible: true,
    },
  ]
  let bannerCount = 0
  for (const b of banners) {
    // 이미 같은 title 있으면 skip
    const { data: exists } = await sb.from('banners')
      .select('id').eq('section_id', bannerSection.id).eq('title', b.title).maybeSingle()
    if (exists) { console.log(`  · ${b.title} (이미 존재)`); continue }
    const { error } = await sb.from('banners').insert({ ...b, section_id: bannerSection.id })
    if (error) console.error(`  ✗ ${b.title}: ${error.message}`)
    else { bannerCount++; console.log(`  ✓ ${b.title}`) }
  }
  console.log(`  ${bannerCount} 새 배너 추가`)
}

// ════════════════════════════════════════════════════
// 4. 공지사항 3개
// ════════════════════════════════════════════════════
console.log('\n[4/5] 공지사항...')
const NOTICES = [
  {
    title: 'Ingrow LMS 정식 오픈 안내',
    content: '안녕하세요. Ingrow LMS가 정식 오픈했습니다.\n\n다양한 분야의 실무 강좌를 만나보실 수 있으며, 기업 단위 도입도 가능합니다.\n\n많은 관심 부탁드립니다.',
    is_pinned: true,
    is_active: true,
  },
  {
    title: '11월 신규 강좌 5종 추가',
    content: '11월 신규 강좌 5종이 업로드되었습니다.\n\n- SQL 기초부터 실무까지\n- Python 데이터 분석 입문\n- 디지털 마케팅 입문\n- React 입문\n- ChatGPT 업무 활용법\n\n지금 바로 학습을 시작해보세요!',
    is_pinned: false,
    is_active: true,
  },
  {
    title: '학습 가이드 및 수료 기준 안내',
    content: '강좌별 수료 조건은 다음과 같습니다:\n\n1. 전체 강의의 80% 이상 시청\n2. 마지막 강의까지 진도율 도달\n\n수료 시 자동으로 수료증이 발급되며 LinkedIn 프로필에 추가하실 수 있습니다.',
    is_pinned: false,
    is_active: true,
  },
]
let noticeCount = 0
for (const n of NOTICES) {
  const { data: exists } = await sb.from('notices').select('id').eq('title', n.title).maybeSingle()
  if (exists) { console.log(`  · ${n.title}`); continue }
  const { error } = await sb.from('notices').insert(n)
  if (error) console.error(`  ✗ ${n.title}: ${error.message}`)
  else { noticeCount++; console.log(`  ✓ ${n.title}`) }
}
console.log(`  ${noticeCount} 새 공지 추가`)

// ════════════════════════════════════════════════════
// 5. FAQ 5개
// ════════════════════════════════════════════════════
console.log('\n[5/5] FAQ...')
const FAQS = [
  { category: 'general', question: '수강 신청은 어떻게 하나요?',
    answer: '강좌 상세 페이지에서 "수강 신청" 버튼을 누르면 즉시 등록됩니다. 무료 강좌는 결제 없이 바로 학습을 시작할 수 있습니다.', sort_order: 1 },
  { category: 'general', question: '수강 기간은 얼마나 되나요?',
    answer: '대부분의 강좌는 신청 후 무제한으로 학습 가능합니다. 일부 기간 한정 강좌는 강좌 상세에 명시되어 있습니다.', sort_order: 2 },
  { category: 'account', question: '비밀번호를 잊어버렸어요',
    answer: '로그인 페이지의 "비밀번호 찾기" 링크를 통해 등록된 이메일로 재설정 링크를 받으실 수 있습니다.', sort_order: 3 },
  { category: 'payment', question: '환불 규정은 어떻게 되나요?',
    answer: '결제 후 7일 이내, 강의 시청 30% 미만 시 100% 환불됩니다. 그 이후엔 환불이 어려우니 미리 미리보기 영상을 확인해주세요.', sort_order: 4 },
  { category: 'course', question: '수료증은 어떻게 발급받나요?',
    answer: '강좌 진도가 80% 이상 도달하면 자동으로 수료증이 발급됩니다. "내 강의실 → 수료증" 메뉴에서 PDF로 다운로드하거나 LinkedIn 프로필에 추가할 수 있습니다.', sort_order: 5 },
]
let faqCount = 0
for (const f of FAQS) {
  const { data: exists } = await sb.from('faqs').select('id').eq('question', f.question).maybeSingle()
  if (exists) { console.log(`  · ${f.question}`); continue }
  const { error } = await sb.from('faqs').insert({ ...f, is_active: true })
  if (error) console.error(`  ✗ ${f.question}: ${error.message}`)
  else { faqCount++; console.log(`  ✓ ${f.question}`) }
}
console.log(`  ${faqCount} 새 FAQ 추가`)

console.log('\n═══════════════════════════════════════════')
console.log('  ✅ 콘텐츠 시드 완료')
console.log('═══════════════════════════════════════════')
