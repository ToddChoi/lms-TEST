'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

/**
 * Root global-error boundary — root layout 자체에서 발생한 에러용 fallback.
 * (public)/error.tsx 와 admin/error.tsx 가 catch 못 하는 layout-level 에러를 처리.
 *
 * Next.js 14 App Router: global-error.tsx 는 자체 <html><body> 포함 필수.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('[GlobalError]', error)
  }, [error])

  return (
    <html lang="ko">
      <body
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
          backgroundColor: '#F4F6FA',
          margin: 0,
          padding: '48px 16px',
          minHeight: '100vh',
        }}
      >
        <div
          style={{
            maxWidth: '480px',
            margin: '0 auto',
            backgroundColor: '#ffffff',
            borderRadius: '16px',
            padding: '32px 28px',
            textAlign: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          <h1 style={{ color: '#0B1F3A', fontSize: '20px', fontWeight: 700, margin: '0 0 12px' }}>
            서비스 오류가 발생했습니다
          </h1>
          <p style={{ color: '#6B7280', fontSize: '14px', lineHeight: 1.6, margin: '0 0 24px' }}>
            일시적인 문제로 페이지를 표시할 수 없습니다.
            <br />
            잠시 후 다시 시도해주세요.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: '#2D7DD2',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 600,
              padding: '10px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          {error.digest && (
            <p style={{ color: '#9CA3AF', fontSize: '11px', marginTop: '16px' }}>
              오류 코드: <code>{error.digest}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  )
}
