/**
 * 기업 단체 신청 시 참석자 CSV 파싱.
 *
 * P0 보안 (PRD §7-3, DATA_MODEL_OFFLINE_V2.md 부록 B):
 *   - 파일 크기: ≤ 1MB
 *   - 행 수: ≤ 500
 *   - CSV Injection 차단: =, +, -, @, TAB, CR 로 시작하는 셀은 prefix `'` 추가
 *     (Excel/Sheets 에서 다운로드 후 열 때 formula 자동 실행 차단)
 *   - 인코딩: UTF-8 (BOM 허용)
 *   - 필수 헤더: name. 선택: email / phone / department / position. 그 외 컬럼 무시.
 *
 * 의존성 없음 — 작은 직접 파서.
 * CSV 표준 RFC 4180 의 핵심만 지원 (큰따옴표 escape, 콤마 구분, CRLF/LF 줄바꿈).
 */

export const CSV_MAX_BYTES = 1_048_576 // 1 MB
export const CSV_MAX_ROWS = 500

export interface ParsedAttendee {
  name: string
  email: string | null
  phone: string | null
  department: string | null
  position: string | null
}

export type CsvParseResult =
  | { ok: true; rows: ParsedAttendee[] }
  | { ok: false; error: string; lineNumber?: number }

const HEADER_ALIASES: Record<string, keyof ParsedAttendee> = {
  // 한글 / 영문 헤더 모두 허용
  name: 'name', '이름': 'name', '성명': 'name',
  email: 'email', '이메일': 'email', 'e-mail': 'email',
  phone: 'phone', '전화': 'phone', '연락처': 'phone', '핸드폰': 'phone', '휴대폰': 'phone',
  department: 'department', '부서': 'department', '소속': 'department',
  position: 'position', '직책': 'position', '직급': 'position',
}

const INJECTION_PREFIX = /^[=+\-@\t\r]/

/** CSV injection 차단 — 위험한 prefix 가 있으면 `'` 로 escape */
function sanitizeCell(raw: string): string {
  const v = raw.trim()
  if (!v) return ''
  return INJECTION_PREFIX.test(v) ? `'${v}` : v
}

/**
 * 한 줄을 콤마로 split — 큰따옴표 안의 콤마는 보존. RFC 4180 핵심.
 */
function splitCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++ // escaped quote
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        cells.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  cells.push(current)
  return cells
}

/**
 * CSV 텍스트 → 참석자 배열.
 * 호출자: 파일 업로드 → ArrayBuffer → TextDecoder('utf-8') → string → 본 함수.
 */
export function parseAttendeesCsv(text: string): CsvParseResult {
  // 사이즈 가드 (호출자가 한 번 더 byte length 체크하지만 안전망)
  if (text.length > CSV_MAX_BYTES * 2) {
    // UTF-8 string length 가 byte 의 최대 2배 — 거친 상한
    return { ok: false, error: '파일이 너무 큽니다 (1MB 초과).' }
  }

  // BOM 제거
  const stripped = text.replace(/^﻿/, '')

  // 줄 분리 (CRLF / LF 모두)
  const lines = stripped.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0)
  if (lines.length === 0) {
    return { ok: false, error: '빈 파일입니다.' }
  }
  if (lines.length - 1 > CSV_MAX_ROWS) {
    return {
      ok: false,
      error: `참석자 수가 너무 많습니다 (최대 ${CSV_MAX_ROWS}명, 현재 ${lines.length - 1}명).`,
    }
  }

  // 헤더 파싱
  const headerCells = splitCsvLine(lines[0]).map((c) => c.trim().toLowerCase())
  const fieldMap: (keyof ParsedAttendee | null)[] = headerCells.map(
    (h) => HEADER_ALIASES[h] ?? null
  )
  if (!fieldMap.includes('name')) {
    return {
      ok: false,
      error: '필수 헤더 "name" (또는 "이름") 이 없습니다. 첫 행에 헤더를 포함해주세요.',
    }
  }

  const rows: ParsedAttendee[] = []
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const attendee: ParsedAttendee = {
      name: '',
      email: null,
      phone: null,
      department: null,
      position: null,
    }
    for (let j = 0; j < cells.length; j++) {
      const field = fieldMap[j]
      if (!field) continue
      const value = sanitizeCell(cells[j])
      if (field === 'name') {
        attendee.name = value
      } else {
        attendee[field] = value || null
      }
    }
    if (!attendee.name) {
      return {
        ok: false,
        error: `${i + 1}행: name 이 비어 있습니다.`,
        lineNumber: i + 1,
      }
    }
    rows.push(attendee)
  }

  if (rows.length === 0) {
    return { ok: false, error: '데이터 행이 없습니다. 헤더 외 최소 1명 이상 입력하세요.' }
  }
  return { ok: true, rows }
}
