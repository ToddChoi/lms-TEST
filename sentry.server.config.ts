/**
 * Sentry — Node.js (server / Server Actions / Route Handlers / RSC) 사이드 init.
 * Next.js 의 instrumentation.ts 가 nodejs runtime 일 때 import.
 *
 * DSN 미설정 시 enabled: false → Sentry 완전 비활성 (앱 정상 동작).
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const env = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: env,
  // production 만 traces 수집 (개발 노이즈 방지)
  tracesSampleRate: env === 'production' ? 0.1 : 0,
  // PII / 요청 본문은 기본 미수집. 필요 시 Sentry > Project > Security & Privacy 에서 별도 설정.
  sendDefaultPii: false,
  // 자동 instrumentation — fetch / next-route / postgres 등 추적
  // (Sentry 10 에서 기본 활성)
})
