/**
 * Sentry — Edge runtime (middleware / edge route handlers) 사이드 init.
 * 현재 미들웨어가 edge 에서 동작하므로 별도 설정.
 */
import * as Sentry from '@sentry/nextjs'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
const env = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development'

Sentry.init({
  dsn,
  enabled: !!dsn,
  environment: env,
  tracesSampleRate: env === 'production' ? 0.1 : 0,
  sendDefaultPii: false,
})
