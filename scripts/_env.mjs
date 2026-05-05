/**
 * 모든 시드/디버깅 스크립트가 공유하는 환경변수 로더.
 *  - .env.local 자동 로드 (dotenv 의존 없이 직접 파싱)
 *  - SUPABASE_URL + SERVICE_ROLE_KEY 형식까지 검증 후 반환
 *
 * 사용:
 *   import { sb } from './_env.mjs'
 *   const { data } = await sb.from('...').select('...')
 */

import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

// .env.local 파일 직접 파싱 (dotenv 패키지 의존 X)
function loadDotEnvLocal() {
  const here = dirname(fileURLToPath(import.meta.url))
  const candidates = [
    resolve(here, '..', '.env.local'),
    resolve(here, '..', '.env'),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    const raw = readFileSync(path, 'utf-8')
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq < 0) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      // 따옴표 제거
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      if (process.env[key] === undefined) process.env[key] = value
    }
    return
  }
}

loadDotEnvLocal()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

/**
 * 키 형식 검증 — 흔한 실수를 사전 차단.
 *  반환: { ok, kind, reason }
 *    kind: 'sb_secret' | 'sb_publishable' | 'legacy_jwt' | 'unknown'
 */
function classifyKey(k) {
  if (!k) return { ok: false, kind: 'unknown', reason: '키 자체가 비어있음' }
  if (k.includes('*')) {
    return { ok: false, kind: 'unknown',
      reason: `마스킹 문자(*) 포함. Dashboard에서 눈(👁) 아이콘을 눌러 실제 값을 보여준 뒤 "Copy" 버튼으로 복사해야 합니다.` }
  }
  if (k.startsWith('sb_secret_')) {
    if (k.length < 30) return { ok: false, kind: 'sb_secret', reason: `너무 짧음 (길이 ${k.length}). 잘린 채 붙여넣었을 가능성.` }
    return { ok: true, kind: 'sb_secret', reason: 'sb_secret_ — service_role 동등, RLS bypass 가능' }
  }
  if (k.startsWith('sb_publishable_')) {
    return { ok: false, kind: 'sb_publishable',
      reason: `★ publishable 키가 SERVICE_ROLE 슬롯에 들어있음. 이건 anon 동등이라 RLS를 못 뚫습니다.\n   → Dashboard → API Keys → "Secret keys" 탭의 sb_secret_... 값으로 교체하세요.` }
  }
  if (k.startsWith('eyJ')) {
    // legacy JWT — 동작은 하지만 사용자가 새 키 체계로 옮기는 중이라 경고만
    return { ok: true, kind: 'legacy_jwt', reason: 'legacy JWT 형식 (정상 동작하나 deprecated 예정)' }
  }
  return { ok: false, kind: 'unknown',
    reason: `알 수 없는 형식. sb_secret_ 또는 eyJ 로 시작해야 합니다. 시작 8자: "${k.slice(0,8)}"` }
}

if (!SUPABASE_URL) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL 미설정')
  process.exit(1)
}
if (!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(SUPABASE_URL.replace(/\/$/, '') + '/')) {
  // 형식만 가볍게 체크
}

const verdict = classifyKey(SERVICE_ROLE_KEY)
if (!verdict.ok) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY 형식 오류')
  console.error('   ' + verdict.reason)
  console.error('   현재 값 시작 12자: ' + (SERVICE_ROLE_KEY?.slice(0, 12) ?? '(empty)'))
  console.error('   현재 값 길이    : ' + (SERVICE_ROLE_KEY?.length ?? 0))
  process.exit(1)
}

// 정상 — 종류만 한 줄 안내 (스크립트 첫 실행 때 한 번 보여 줌)
if (!process.env.__ENV_BANNER_SHOWN) {
  process.env.__ENV_BANNER_SHOWN = '1'
  console.log(`✓ env: ${verdict.kind} 키 로드됨 — ${verdict.reason}`)
}

export const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

export { SUPABASE_URL, SERVICE_ROLE_KEY }
export const KEY_KIND = verdict.kind
