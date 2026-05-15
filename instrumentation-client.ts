/**
 * Sentry — 브라우저 client 사이드 init.
 * Next.js 14 의 instrumentation-client.ts 는 자동 로딩 (separate from instrumentation.ts).
 *
 * Sentry v10+ 권장 패턴 — 기존 sentry.client.config.ts 대체.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const env = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: env,
  tracesSampleRate: env === 'production' ? 0.1 : 0,
  // session replay — 개발 단계에선 비활성. 추후 production 에서 0.1 정도로 켜기.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: env === 'production' ? 1.0 : 0,
  // 사용자 PII 자동 수집 X (이메일/IP)
  sendDefaultPii: false,
  // 통합 — production 일 때만 replay 사용
  integrations: env === 'production' && dsn
    ? [Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })]
    : [],
})

// router transition 추적 (App Router)
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
