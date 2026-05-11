import { randomBytes } from 'node:crypto'

/**
 * 회차 일자별 QR 토큰 생성. 32 바이트 random → base64url ≈ 43 자.
 *
 * 보안 요구사항 (P0 — docs/DATA_MODEL_OFFLINE_V2.md):
 *   - 추측 불가능한 256-bit entropy
 *   - sequential / timestamp 기반 토큰 절대 X
 *   - DB schema: length(qr_token) >= 32 CHECK
 *
 * 서버 전용 (Node crypto). API route / Server Component 에서만 호출.
 */
export function generateQrToken(): string {
  return randomBytes(32).toString('base64url')
}
