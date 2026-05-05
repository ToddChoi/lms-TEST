import { sb } from './_env.mjs'

// ─── 1. 카테고리 조회 (없으면 삽입) ───────────────────────────
let { data: categories } = await sb.from('categories').select('id, slug')

if (!categories || categories.length === 0) {
  console.log('카테고리가 없습니다. 초기 데이터 삽입 중...')
  const { data: inserted } = await sb.from('categories').insert([
    { name: 'AI 직무/업무 생산성', slug: 'ai', sort_order: 1 },
    { name: '실무 역량', slug: 'business', sort_order: 2 },
    { name: '메타버스', slug: 'metaverse', sort_order: 3 },
    { name: '자격증', slug: 'certificate', sort_order: 4 },
  ]).select('id, slug')
  categories = inserted
}

const cat = Object.fromEntries((categories ?? []).map(c => [c.slug, c.id]))
console.log('카테고리:', cat)

// ─── 2. 강좌 5개 ───────────────────────────────────────────────
const courses = [
  {
    title: 'ChatGPT로 업무 생산성 10배 높이기',
    slug: 'chatgpt-productivity',
    description: 'ChatGPT를 활용해 문서 작성, 데이터 분석, 업무 자동화를 마스터합니다. 실무에서 바로 쓸 수 있는 프롬프트 작성법과 GPT 플러그인 활용법을 배웁니다.',
    category_id: cat['ai'],
    price: 0,
    level: 'beginner',
    status: 'active',
    is_featured: true,
    total_duration: 18000,
    thumbnail_url: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=640&q=80',
  },
  {
    title: 'Python 데이터 분석 입문',
    slug: 'python-data-analysis',
    description: '파이썬의 pandas, numpy, matplotlib을 활용한 데이터 분석 기초부터 실전까지. 엑셀 없이 데이터를 다루는 방법을 배웁니다.',
    category_id: cat['business'],
    price: 0,
    level: 'beginner',
    status: 'active',
    is_featured: true,
    total_duration: 27000,
    thumbnail_url: 'https://images.unsplash.com/photo-1526379095098-d400fd0bf935?w=640&q=80',
  },
  {
    title: 'AI 이미지 생성 마스터클래스',
    slug: 'ai-image-generation',
    description: 'Midjourney, DALL·E 3, Stable Diffusion을 활용한 AI 이미지 생성 완벽 가이드. 프롬프트 엔지니어링부터 상업적 활용까지.',
    category_id: cat['ai'],
    price: 39000,
    level: 'intermediate',
    status: 'active',
    is_featured: false,
    total_duration: 21600,
    thumbnail_url: 'https://images.unsplash.com/photo-1686191128892-3b37add4c844?w=640&q=80',
  },
  {
    title: '메타버스 비즈니스 플랫폼 구축',
    slug: 'metaverse-business',
    description: 'Gather.town, Zep, ifland를 활용한 기업 메타버스 공간 구축 실전 강의. 온보딩, 교육, 행사를 메타버스로 옮기는 방법을 배웁니다.',
    category_id: cat['metaverse'],
    price: 49000,
    level: 'intermediate',
    status: 'active',
    is_featured: false,
    total_duration: 32400,
    thumbnail_url: 'https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=640&q=80',
  },
  {
    title: '정보처리기사 필기 완전정복',
    slug: 'information-processing-engineer',
    description: '2025년 최신 출제기준 반영. 소프트웨어 설계, 데이터베이스, 네트워크, 정보보안 핵심 이론과 기출문제 완전분석.',
    category_id: cat['certificate'],
    price: 89000,
    level: 'intermediate',
    status: 'active',
    is_featured: true,
    total_duration: 72000,
    thumbnail_url: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=640&q=80',
  },
]

const { data: insertedCourses, error: courseErr } = await supabase
  .from('courses')
  .insert(courses)
  .select('id, title, slug')

if (courseErr) { console.error('강좌 삽입 오류:', courseErr); process.exit(1) }
console.log('강좌 삽입 완료:', insertedCourses.map(c => c.title))

// ─── 3. 섹션 + 레슨 ───────────────────────────────────────────
const curriculum = {
  'chatgpt-productivity': [
    {
      title: '1장. ChatGPT 기초 & 시작하기',
      sort_order: 1,
      lessons: [
        { title: 'ChatGPT란 무엇인가?', duration: 600, is_preview: true, sort_order: 1, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'ChatGPT 계정 생성 및 인터페이스 이해', duration: 720, is_preview: true, sort_order: 2, video_url: null },
        { title: '기본 프롬프트 작성법', duration: 900, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '2장. 업무 자동화 실전',
      sort_order: 2,
      lessons: [
        { title: '이메일·보고서 초안 자동 생성', duration: 1080, is_preview: false, sort_order: 1, video_url: null },
        { title: '데이터 요약 & 분석 요청하기', duration: 960, is_preview: false, sort_order: 2, video_url: null },
        { title: '반복 업무 프롬프트 템플릿 만들기', duration: 1200, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '3장. 고급 활용 & GPT 플러그인',
      sort_order: 3,
      lessons: [
        { title: 'GPT-4o 이미지 분석 활용', duration: 840, is_preview: false, sort_order: 1, video_url: null },
        { title: 'Custom GPTs 만들기', duration: 1500, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
  ],
  'python-data-analysis': [
    {
      title: '1장. Python & 환경 설정',
      sort_order: 1,
      lessons: [
        { title: 'Python 설치 및 Jupyter Notebook 시작', duration: 900, is_preview: true, sort_order: 1, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: '기본 문법: 변수, 리스트, 딕셔너리', duration: 1200, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
    {
      title: '2장. pandas로 데이터 다루기',
      sort_order: 2,
      lessons: [
        { title: 'DataFrame 생성 및 기본 조작', duration: 1500, is_preview: false, sort_order: 1, video_url: null },
        { title: '결측치 처리 & 데이터 정제', duration: 1080, is_preview: false, sort_order: 2, video_url: null },
        { title: 'groupby & pivot 집계 분석', duration: 1260, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '3장. 시각화 & 실전 프로젝트',
      sort_order: 3,
      lessons: [
        { title: 'matplotlib & seaborn 차트 그리기', duration: 1440, is_preview: false, sort_order: 1, video_url: null },
        { title: '실전: 매출 데이터 분석 프로젝트', duration: 2400, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
  ],
  'ai-image-generation': [
    {
      title: '1장. AI 이미지 생성 개요',
      sort_order: 1,
      lessons: [
        { title: 'Midjourney, DALL·E, SD 비교', duration: 780, is_preview: true, sort_order: 1, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: 'Midjourney 첫 이미지 생성', duration: 900, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
    {
      title: '2장. 프롬프트 엔지니어링',
      sort_order: 2,
      lessons: [
        { title: '스타일 키워드 완전 정리', duration: 1200, is_preview: false, sort_order: 1, video_url: null },
        { title: '고급 파라미터 활용 (--ar, --v, --s)', duration: 960, is_preview: false, sort_order: 2, video_url: null },
        { title: '참조 이미지로 일관된 캐릭터 만들기', duration: 1500, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '3장. 상업적 활용',
      sort_order: 3,
      lessons: [
        { title: '썸네일 & SNS 콘텐츠 제작', duration: 1080, is_preview: false, sort_order: 1, video_url: null },
        { title: '저작권 & 라이선스 이해', duration: 600, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
  ],
  'metaverse-business': [
    {
      title: '1장. 메타버스 플랫폼 비교',
      sort_order: 1,
      lessons: [
        { title: 'Gather.town vs Zep vs ifland 비교', duration: 900, is_preview: true, sort_order: 1, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: '기업 도입 사례 분석', duration: 780, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
    {
      title: '2장. Zep으로 사무실 구축',
      sort_order: 2,
      lessons: [
        { title: 'Zep 공간 생성 & 커스터마이징', duration: 1800, is_preview: false, sort_order: 1, video_url: null },
        { title: '오브젝트 & 상호작용 설정', duration: 1440, is_preview: false, sort_order: 2, video_url: null },
        { title: '화상회의 & 세미나룸 세팅', duration: 1200, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '3장. 운영 & 확장',
      sort_order: 3,
      lessons: [
        { title: '직원 온보딩 프로그램 설계', duration: 1560, is_preview: false, sort_order: 1, video_url: null },
        { title: '메타버스 행사 기획 & 운영', duration: 1800, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
  ],
  'information-processing-engineer': [
    {
      title: '1과목. 소프트웨어 설계',
      sort_order: 1,
      lessons: [
        { title: '요구사항 분석 & UML 기초', duration: 2400, is_preview: true, sort_order: 1, video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
        { title: '객체지향 설계 원칙 (SOLID)', duration: 2160, is_preview: false, sort_order: 2, video_url: null },
        { title: '디자인 패턴 핵심 20선', duration: 2700, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '2과목. 데이터베이스',
      sort_order: 2,
      lessons: [
        { title: '관계형 DB & 정규화', duration: 2400, is_preview: false, sort_order: 1, video_url: null },
        { title: 'SQL 핵심 문법 총정리', duration: 3000, is_preview: false, sort_order: 2, video_url: null },
        { title: '트랜잭션 & 회복', duration: 1800, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
    {
      title: '3과목. 네트워크 & 보안',
      sort_order: 3,
      lessons: [
        { title: 'OSI 7계층 & TCP/IP', duration: 2700, is_preview: false, sort_order: 1, video_url: null },
        { title: '암호화 & 정보보안 기초', duration: 2400, is_preview: false, sort_order: 2, video_url: null },
      ]
    },
    {
      title: '4과목. 기출문제 풀이',
      sort_order: 4,
      lessons: [
        { title: '2024년 1회 기출 완전분석', duration: 3600, is_preview: false, sort_order: 1, video_url: null },
        { title: '2024년 2회 기출 완전분석', duration: 3600, is_preview: false, sort_order: 2, video_url: null },
        { title: '오답 유형별 핵심 정리', duration: 2400, is_preview: false, sort_order: 3, video_url: null },
      ]
    },
  ],
}

// 강좌별 섹션·레슨 삽입
for (const course of insertedCourses) {
  const sections = curriculum[course.slug]
  if (!sections) continue

  for (const sec of sections) {
    const { data: insertedSection, error: secErr } = await supabase
      .from('sections')
      .insert({ course_id: course.id, title: sec.title, sort_order: sec.sort_order })
      .select('id')
      .single()

    if (secErr) { console.error('섹션 오류:', secErr); continue }

    const lessons = sec.lessons.map(l => ({
      section_id: insertedSection.id,
      course_id: course.id,
      title: l.title,
      duration: l.duration,
      is_preview: l.is_preview,
      sort_order: l.sort_order,
      video_url: l.video_url,
    }))

    const { error: lessonErr } = await sb.from('lessons').insert(lessons)
    if (lessonErr) console.error('레슨 오류:', lessonErr)
  }

  console.log(`✓ ${course.title} — 커리큘럼 삽입 완료`)
}

console.log('\n🎉 시드 완료!')
