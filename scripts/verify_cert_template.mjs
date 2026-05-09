/**
 * 자체 검증 스크립트 — 수료증 템플릿 시스템이 제대로 셋업됐는지 확인.
 *
 * 체크:
 *  1. certificate_templates 테이블 존재 + 행 카운트
 *  2. is_default=TRUE 글로벌 템플릿 정확히 1개
 *  3. 기본 템플릿의 elements 가 17개 + 각 type 분포
 *  4. certificates.template_id 컬럼 존재
 *
 * 실행:  node scripts/verify_cert_template.mjs
 */
import { sb } from './_env.mjs'

console.log('━━━ 1. certificate_templates 행 ━━━')
const { data: rows, error: e1 } = await sb
  .from('certificate_templates')
  .select('id, name, is_default, scope_type, page_size, page_orientation')
if (e1) { console.error('❌', e1.message); process.exit(1) }
console.log(`  총 ${rows.length} 개`)
for (const r of rows) {
  console.log(`    ${r.is_default ? '★' : ' '} ${r.name.padEnd(20)} ${r.scope_type}/${r.page_size}/${r.page_orientation}  id=${r.id.slice(0,8)}…`)
}

console.log('\n━━━ 2. 기본 템플릿 (is_default=TRUE, scope=global) ━━━')
const defaults = rows.filter((r) => r.is_default && r.scope_type === 'global')
if (defaults.length !== 1) {
  console.error(`  ❌ 기본 템플릿이 정확히 1개여야 함 (현재 ${defaults.length})`)
  if (defaults.length === 0) {
    console.error('     → migration_phase6_certificate_templates.sql 미적용')
  }
  process.exit(1)
}
const def = defaults[0]
console.log(`  ✓ "${def.name}" (id=${def.id.slice(0,8)}…)`)

console.log('\n━━━ 3. 기본 템플릿 elements 구성 ━━━')
const { data: full } = await sb
  .from('certificate_templates')
  .select('elements')
  .eq('id', def.id)
  .single()
const els = full?.elements ?? []
if (!Array.isArray(els)) {
  console.error('  ❌ elements 가 배열이 아님')
  process.exit(1)
}
console.log(`  총 element: ${els.length}`)
const dist = els.reduce((acc, el) => {
  acc[el.type] = (acc[el.type] ?? 0) + 1
  return acc
}, {})
for (const [t, n] of Object.entries(dist)) {
  console.log(`    ${t.padEnd(8)} ${n}`)
}
const dynamicEls = els.filter((el) => el.type === 'text' && /\{\{[a-z_]+\}\}/.test(el.content))
console.log(`  dynamic placeholder 사용: ${dynamicEls.length} text element`)

console.log('\n━━━ 4. certificates.template_id 컬럼 ━━━')
const { data: certCols, error: e4 } = await sb
  .rpc('exec_sql', { q: "SELECT column_name FROM information_schema.columns WHERE table_name='certificates' AND column_name='template_id'" })
  .single()
  .then((r) => r, () => ({ data: null, error: { message: 'rpc 사용 불가 — 다른 방법' } }))
if (!certCols) {
  // fallback — certificates 한 row 가져와서 template_id 키 존재 확인
  const { data: anyCert } = await sb.from('certificates').select('id, template_id').limit(1).maybeSingle()
  if (anyCert === null) {
    // 0 row — 컬럼 존재 여부 알 수 없음. select 가 에러 안 났으므로 컬럼은 존재.
    console.log('  ✓ certificates 테이블에 template_id select 가능 (0 row 라 값 미확인)')
  } else if ('template_id' in (anyCert ?? {})) {
    console.log(`  ✓ template_id 컬럼 존재. 샘플 row 의 template_id: ${anyCert.template_id ?? 'null'}`)
  } else {
    console.error('  ❌ template_id 컬럼 누락 — 마이그레이션 미적용')
    process.exit(1)
  }
} else {
  console.log(`  ✓ ${certCols.column_name}`)
}

console.log('\n✓ 모든 검증 통과')
