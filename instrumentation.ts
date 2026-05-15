/**
 * Next.js Instrumentation hook — 서버 시작 시 한 번 실행.
 * runtime 별로 적절한 Sentry config 를 동적 import.
 *
 * 참고: client-side 는 instrumentation-client.ts 가 별도 자동 로드.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}

// Next.js 15 / 14 의 onRequestError hook — Server Components / Route Handlers /
// Server Actions 에서 발생한 에러를 Sentry 로 자동 캡처.
export const onRequestError = Sentry.captureRequestError
