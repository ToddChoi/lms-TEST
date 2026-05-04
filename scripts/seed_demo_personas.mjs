/**
 * 4가지 페르소나 시연용 데이터 시드 스크립트
 *
 * 생성:
 *  - 계정 7개 (admin / instructor 2 / company manager / student 3)
 *  - 카테고리 5개
 *  - 강좌 8개 (강사 배정·섹션·강의 포함)
 *  - 회사 1개 + 회사멤버 3명
 *  - 수강 신청 8건 + 다양한 진도
 *  - 수강평 6개 + Q&A 3건
 *  - 수료증 2개
 *
 * 실행:
 *   node scripts/seed_demo_personas.mjs
 *
 * 정리 (시연 끝난 후):
 *   node scripts/cleanup_demo_personas.mjs
 *
 * 비밀번호: Demo1234!
 * 이메일 패턴: *@demo.com (cleanup에서 식별용)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://unrhoadjtyyuqvtdeyks.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVucmhvYWRqdHl5dXF2dGRleWtzIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjE0MjE0OSwiZXhwIjoyMDkxNzE4MTQ5fQ.JQET6tG2jeM8THB2_kdQse4QfcGeH9RmQgYQkv9QO-0'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const DEMO_PASSWORD = 'Demo1234!'

// ════════════════════════════════════════════════════
// 1. 계정 생성
// ════════════════════════════════════════════════════
const ACCOUNTS = [
  { key: 'admin',       email: 'admin@demo.com',       name: '관리자',  role: 'admin'      },
  { key: 'instructor1', email: 'instructor1@demo.com', name: '김지훈',  role: 'instructor' },
  { key: 'instructor2', email: 'instructor2@demo.com', name: '이서연',  role: 'instructor' },
  { key: 'manager',     email: 'manager@demo.com',     name: '박매니저', role: 'student'    },
  { key: 'student1',    email: 'student1@demo.com',    name: '최학습',  role: 'student'    },
  { key: 'student2',    email: 'student2@demo.com',    name: '정수강',  role: 'student'    },
  { key: 'student3',    email: 'student3@demo.com',    name: '강배움',  role: 'student'    },
]

async function ensureAccounts() {
  console.log('\n[1/8] 계정 생성/확인...')
  const userMap = {}

  // 기존 사용자 한 번에 조회
  const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const byEmail = new Map((existing?.users ?? []).map((u) => [u.email, u]))

  for (const a of ACCOUNTS) {
    let user = byEmail.get(a.email)
    if (!user) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: a.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: a.name },
      })
      if (error) { console.error(`  ✗ ${a.email}: ${error.message}`); continue }
      user = data.user
      console.log(`  ✓ created ${a.email}`)
    } else {
      console.log(`  · exists  ${a.email}`)
    }
    userMap[a.key] = user.id

    // profiles upsert (트리거가 자동 생성했어도 role 보강)
    await supabase.from('profiles').upsert({
      id: user.id,
      email: a.email,
      name: a.name,
      role: a.role,
    }, { onConflict: 'id' })
  }
  return userMap
}

// ════════════════════════════════════════════════════
// 2. 카테고리
// ════════════════════════════════════════════════════
const CATEGORIES = [
  { slug: 'data',      name: '데이터분석', icon: '📊', sort_order: 1 },
  { slug: 'marketing', name: '마케팅',     icon: '📣', sort_order: 2 },
  { slug: 'dev',       name: '개발',       icon: '💻', sort_order: 3 },
  { slug: 'ai',        name: 'AI',         icon: '🤖', sort_order: 4 },
  { slug: 'hr',        name: 'HR',         icon: '👥', sort_order: 5 },
]

async function ensureCategories() {
  console.log('\n[2/8] 카테고리...')
  const idMap = {}
  for (const c of CATEGORIES) {
    const { data: existing } = await supabase.from('categories').select('id').eq('slug', c.slug).maybeSingle()
    if (existing?.id) {
      idMap[c.slug] = existing.id
      console.log(`  · exists  ${c.slug}`)
      continue
    }
    const { data, error } = await supabase
      .from('categories')
      .insert({ ...c, is_visible: true })
      .select('id').single()
    if (error) { console.error(`  ✗ ${c.slug}: ${error.message}`); continue }
    idMap[c.slug] = data.id
    console.log(`  ✓ created ${c.slug}`)
  }
  return idMap
}

// ════════════════════════════════════════════════════
// 3. 강좌
// ════════════════════════════════════════════════════
function makeCourses(catIds, userIds) {
  return [
    {
      slug: 'demo-sql-basics', title: 'SQL 기초부터 실무까지',
      description: '0부터 시작해 실무에서 통하는 SQL 작성법',
      category_id: catIds.data, instructor_id: userIds.instructor1,
      level: 'beginner', price: 0, badge: 'best',
    },
    {
      slug: 'demo-python-data', title: 'Python 데이터 분석 입문',
      description: 'pandas / numpy 로 실제 데이터를 다뤄봅니다',
      category_id: catIds.data, instructor_id: userIds.instructor1,
      level: 'intermediate', price: 79000, price_original: 99000,
    },
    {
      slug: 'demo-marketing-101', title: '디지털 마케팅 입문',
      description: '검색·광고·콘텐츠의 기본기',
      category_id: catIds.marketing, instructor_id: userIds.instructor2,
      level: 'beginner', price: 0, badge: 'new',
    },
    {
      slug: 'demo-perf-marketing', title: '퍼포먼스 마케팅 실전',
      description: 'GA4·Meta 광고·전환 최적화',
      category_id: catIds.marketing, instructor_id: userIds.instructor2,
      level: 'advanced', price: 149000,
    },
    {
      slug: 'demo-react-intro', title: 'React 입문',
      description: '컴포넌트 기반 UI 개발 시작하기',
      category_id: catIds.dev, instructor_id: userIds.instructor1,
      level: 'beginner', price: 89000, badge: 'hot',
    },
    {
      slug: 'demo-typescript-real', title: 'TypeScript 실전',
      description: '타입 안전한 백엔드/프론트엔드 코드',
      category_id: catIds.dev, instructor_id: userIds.instructor1,
      level: 'intermediate', price: 99000,
    },
    {
      slug: 'demo-chatgpt-work', title: 'ChatGPT 업무 활용법',
      description: '문서 작성·요약·번역 자동화',
      category_id: catIds.ai, instructor_id: userIds.instructor2,
      level: 'beginner', price: 0,
    },
    {
      slug: 'demo-onboarding', title: '신입사원 온보딩 가이드',
      description: '입사 첫 90일 — 빠르게 적응하는 법',
      category_id: catIds.hr, instructor_id: userIds.instructor2,
      level: 'beginner', price: 0,
    },
  ]
}

async function ensureCourses(catIds, userIds) {
  console.log('\n[3/8] 강좌...')
  const courses = makeCourses(catIds, userIds)
  const idMap = {}
  for (const c of courses) {
    const { data: existing } = await supabase.from('courses').select('id').eq('slug', c.slug).maybeSingle()
    if (existing?.id) {
      idMap[c.slug] = existing.id
      console.log(`  · exists  ${c.slug}`)
      continue
    }
    const { data, error } = await supabase.from('courses').insert({
      ...c,
      status: 'active',
      is_featured: true,
      thumbnail_url: null, // 강좌 카드 그라데이션 fallback 활용
    }).select('id').single()
    if (error) {
      console.error(`  ✗ ${c.slug}: ${error.code ?? ''} ${error.message}`)
      if (error.details) console.error(`     details: ${error.details}`)
      continue
    }
    if (!data?.id) {
      console.error(`  ✗ ${c.slug}: insert returned no id (silent fail)`)
      continue
    }
    idMap[c.slug] = data.id
    console.log(`  ✓ created ${c.slug}`)
  }
  return idMap
}

// ════════════════════════════════════════════════════
// 4. 섹션 + 강의
// ════════════════════════════════════════════════════
// 더미 YouTube URL — 실제 시청 가능한 공개 영상 (TED·교육)
const VIDEO_URLS = [
  'https://www.youtube.com/watch?v=arj7oStGLkU', // TED — Inside the mind of a master procrastinator
  'https://www.youtube.com/watch?v=8jPQjjsBbIc', // TED-Ed
  'https://www.youtube.com/watch?v=aircAruvnKk', // 3Blue1Brown
  'https://www.youtube.com/watch?v=jNQXAC9IVRw', // YouTube 첫 영상
  'https://www.youtube.com/watch?v=ZXsQAXx_ao0', // TED
  'https://www.youtube.com/watch?v=OYECfV3ubP8', // 교육
]

async function ensureSectionsAndLessons(courseIds) {
  console.log('\n[4/8] 섹션 + 강의...')
  const lessonMap = {} // courseSlug → [lesson_id, ...]

  for (const [slug, courseId] of Object.entries(courseIds)) {
    // 이미 섹션 있으면 skip
    const { data: existingSecs } = await supabase
      .from('sections').select('id').eq('course_id', courseId).limit(1)
    if (existingSecs && existingSecs.length > 0) {
      // 기존 lesson 이름 모음
      const { data: existingLessons } = await supabase
        .from('lessons')
        .select('id, sections!inner(course_id)')
        .eq('sections.course_id', courseId)
      lessonMap[slug] = (existingLessons ?? []).map((l) => l.id)
      console.log(`  · exists  ${slug} (${lessonMap[slug].length} lessons)`)
      continue
    }

    // 2 섹션 × 3 강의 = 6 강의/강좌
    const lessons = []
    for (let s = 0; s < 2; s++) {
      const { data: section } = await supabase.from('sections').insert({
        course_id: courseId,
        title: s === 0 ? '시작하기' : '실전 적용',
        sort_order: s,
      }).select('id').single()
      if (!section) continue
      for (let l = 0; l < 3; l++) {
        const { data: lesson } = await supabase.from('lessons').insert({
          course_id: courseId,
          section_id: section.id,
          title: `${s === 0 ? 'Lesson' : 'Practice'} ${l + 1}`,
          video_url: VIDEO_URLS[(s * 3 + l) % VIDEO_URLS.length],
          duration: 600 + l * 120, // 10~14분
          sort_order: l,
          is_preview: l === 0 && s === 0, // 첫 강의는 미리보기
        }).select('id').single()
        if (lesson) lessons.push(lesson.id)
      }
    }
    lessonMap[slug] = lessons
    console.log(`  ✓ created ${slug} (${lessons.length} lessons)`)
  }
  return lessonMap
}

// ════════════════════════════════════════════════════
// 5. 회사 + 멤버
// ════════════════════════════════════════════════════
async function ensureCompany(userIds) {
  console.log('\n[5/8] 회사 + 멤버...')
  const companyName = '데모 주식회사'

  const { data: existing } = await supabase
    .from('companies').select('id').eq('name', companyName).maybeSingle()

  let companyId = existing?.id
  if (!companyId) {
    const { data, error } = await supabase.from('companies').insert({
      name: companyName,
    }).select('id').single()
    if (error) { console.error(`  ✗ company: ${error.message}`); return null }
    companyId = data.id
    console.log(`  ✓ created ${companyName}`)
  } else {
    console.log(`  · exists  ${companyName}`)
  }

  // 멤버 추가 (manager, student1, student2)
  const members = [
    { user_id: userIds.manager,  is_manager: true },
    { user_id: userIds.student1, is_manager: false },
    { user_id: userIds.student2, is_manager: false },
  ]
  for (const m of members) {
    await supabase.from('company_members').upsert({
      company_id: companyId,
      ...m,
    }, { onConflict: 'company_id,user_id' })
  }
  console.log(`  ✓ ${members.length} members linked`)
  return companyId
}

// ════════════════════════════════════════════════════
// 6. 수강 신청 + 진도
// ════════════════════════════════════════════════════
const ENROLLMENTS = [
  // student1 — 다양한 진도 (이어보기 카드·streak·캘린더 시연용)
  { user: 'student1', course: 'demo-sql-basics',     progress: 0.8, status: 'active' },
  { user: 'student1', course: 'demo-marketing-101',  progress: 1.0, status: 'completed' },
  { user: 'student1', course: 'demo-react-intro',    progress: 0.4, status: 'active' },
  // student2 — 막 시작
  { user: 'student2', course: 'demo-sql-basics',     progress: 0.5, status: 'active' },
  { user: 'student2', course: 'demo-python-data',    progress: 0.0, status: 'active' },
  // student3 — 수료증 시연용 + 다른 강좌 듣는 중
  { user: 'student3', course: 'demo-chatgpt-work',   progress: 1.0, status: 'completed' },
  { user: 'student3', course: 'demo-onboarding',     progress: 0.6, status: 'active' },
  { user: 'student3', course: 'demo-react-intro',    progress: 0.2, status: 'active' },
]

async function ensureEnrollmentsAndProgress(userIds, courseIds, lessonMap) {
  console.log('\n[6/8] 수강 신청 + 진도...')
  let enrollCount = 0
  let progressCount = 0

  for (const e of ENROLLMENTS) {
    const userId = userIds[e.user]
    const courseId = courseIds[e.course]
    const lessons = lessonMap[e.course] ?? []
    if (!userId || !courseId || lessons.length === 0) continue

    // 수강 신청 upsert
    await supabase.from('enrollments').upsert({
      user_id: userId,
      course_id: courseId,
      status: e.status,
      enrolled_at: new Date(Date.now() - Math.random() * 60 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: 'user_id,course_id' })
    enrollCount++

    // 진도: 앞쪽 강의부터 progress 비율만큼 완료
    const completedCount = Math.round(lessons.length * e.progress)
    for (let i = 0; i < lessons.length; i++) {
      const isCompleted = i < completedCount
      // 다양한 last_watched_at — streak/캘린더 시연용 (최근 30일 내 무작위)
      const daysAgo = Math.floor(Math.random() * 30)
      const lastWatched = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      await supabase.from('lesson_progress').upsert({
        user_id: userId,
        lesson_id: lessons[i],
        course_id: courseId,
        watched_seconds: isCompleted ? 720 : (i === completedCount ? 240 : 0),
        is_completed: isCompleted,
        last_watched_at: i <= completedCount ? lastWatched : null,
      }, { onConflict: 'user_id,lesson_id' })
      progressCount++
    }
  }
  console.log(`  ✓ ${enrollCount} enrollments, ${progressCount} progress rows`)
}

// ════════════════════════════════════════════════════
// 7. 수강평 + Q&A
// ════════════════════════════════════════════════════
const REVIEWS = [
  { user: 'student1', course: 'demo-sql-basics',    rating: 5, content: '실무 예제가 정말 알차요. 입문자에게 강추!' },
  { user: 'student2', course: 'demo-sql-basics',    rating: 4, content: '설명이 깔끔하고 따라가기 쉬웠습니다.' },
  { user: 'student1', course: 'demo-marketing-101', rating: 5, content: '마케팅의 큰 그림을 잡는 데 좋았어요.' },
  { user: 'student3', course: 'demo-chatgpt-work',  rating: 5, content: 'ChatGPT 활용법이 정말 실전적입니다.' },
  { user: 'student3', course: 'demo-onboarding',    rating: 4, content: '신입에게 도움 될 만한 내용 가득.' },
]

async function ensureReviews(userIds, courseIds) {
  console.log('\n[7/8] 수강평...')
  let count = 0
  for (const r of REVIEWS) {
    const userId = userIds[r.user]
    const courseId = courseIds[r.course]
    if (!userId || !courseId) continue
    await supabase.from('course_reviews').upsert({
      user_id: userId,
      course_id: courseId,
      rating: r.rating,
      content: r.content,
      is_verified: true,
    }, { onConflict: 'course_id,user_id' })
    count++
  }
  console.log(`  ✓ ${count} reviews`)

  // Q&A 시연
  console.log('  Q&A...')
  const qa = [
    { user: 'student1', course: 'demo-sql-basics', title: 'JOIN 시 NULL 처리 질문',
      content: 'LEFT JOIN 했을 때 NULL 값이 나오는데 COALESCE로 처리하는 게 맞나요?',
      answer: { user: 'instructor1', content: '네 맞습니다. COALESCE 또는 IFNULL 둘 다 가능해요.', isInstructor: true } },
    { user: 'student2', course: 'demo-react-intro', title: 'useState vs useReducer',
      content: '언제 useReducer 를 써야 하나요?', answer: null },
  ]
  let qCount = 0, aCount = 0
  for (const q of qa) {
    const userId = userIds[q.user]
    const courseId = courseIds[q.course]
    if (!userId || !courseId) continue

    const { data: existingQ } = await supabase
      .from('course_questions').select('id')
      .eq('course_id', courseId).eq('user_id', userId).eq('title', q.title).maybeSingle()
    let questionId = existingQ?.id
    if (!questionId) {
      const { data } = await supabase.from('course_questions').insert({
        user_id: userId, course_id: courseId, title: q.title, content: q.content,
      }).select('id').single()
      questionId = data?.id
      qCount++
    }
    if (q.answer && questionId) {
      const aUserId = userIds[q.answer.user]
      const { data: existingA } = await supabase
        .from('course_answers').select('id')
        .eq('question_id', questionId).eq('user_id', aUserId).maybeSingle()
      if (!existingA) {
        await supabase.from('course_answers').insert({
          question_id: questionId,
          user_id: aUserId,
          content: q.answer.content,
          is_instructor_answer: q.answer.isInstructor,
        })
        aCount++
      }
    }
  }
  console.log(`  ✓ ${qCount} questions, ${aCount} answers`)
}

// ════════════════════════════════════════════════════
// 8. 수료증
// ════════════════════════════════════════════════════
async function ensureCertificates(userIds, courseIds) {
  console.log('\n[8/8] 수료증...')
  const completed = ENROLLMENTS.filter((e) => e.status === 'completed')
  let count = 0
  for (const e of completed) {
    const userId = userIds[e.user]
    const courseId = courseIds[e.course]
    if (!userId || !courseId) continue

    const { data: existing } = await supabase.from('certificates')
      .select('id').eq('user_id', userId).eq('course_id', courseId).maybeSingle()
    if (existing) continue

    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
    await supabase.from('certificates').insert({
      user_id: userId,
      course_id: courseId,
      cert_number: `CERT-${dateStr}-${rand}`,
    })
    count++
  }
  console.log(`  ✓ ${count} certificates`)
}

// ════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════
async function main() {
  console.log('═══════════════════════════════════════════════════')
  console.log('  Demo Personas Seed — 4가지 페르소나 시연용 데이터')
  console.log('═══════════════════════════════════════════════════')

  const userIds = await ensureAccounts()
  const catIds = await ensureCategories()
  const courseIds = await ensureCourses(catIds, userIds)
  const lessonMap = await ensureSectionsAndLessons(courseIds)
  await ensureCompany(userIds)
  await ensureEnrollmentsAndProgress(userIds, courseIds, lessonMap)
  await ensureReviews(userIds, courseIds)
  await ensureCertificates(userIds, courseIds)

  console.log('\n═══════════════════════════════════════════════════')
  console.log('  ✅ 시드 완료')
  console.log('═══════════════════════════════════════════════════')
  console.log('\n로그인 정보 (비밀번호 모두 동일):')
  console.log(`  password: ${DEMO_PASSWORD}`)
  for (const a of ACCOUNTS) {
    console.log(`  ${a.role.padEnd(10)} | ${a.email.padEnd(28)} | ${a.name}`)
  }
  console.log('\n시연 시 각 계정으로 로그인하세요.')
}

main().catch((e) => {
  console.error('\n❌ Seed failed:', e)
  process.exit(1)
})
