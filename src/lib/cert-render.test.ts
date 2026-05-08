import { describe, it, expect } from 'vitest'
import { substitute, formatDuration, formatCertDate } from './cert-render'

const sample = {
  recipient_name: '홍길동',
  course_title: 'AI 입문',
  course_duration: '8시간 30분',
  enrolled_at: '2026년 03월 15일',
  completed_at: '2026년 05월 06일',
  cert_number: 'CERT-20260506-AB12',
  instructor_name: '김강사',
}

describe('substitute', () => {
  it('치환', () => {
    expect(substitute('수료자 {{recipient_name}}', sample)).toBe('수료자 홍길동')
    expect(substitute('{{course_title}} ({{course_duration}})', sample)).toBe('AI 입문 (8시간 30분)')
  })
  it('알 수 없는 키 → 빈 문자열', () => {
    expect(substitute('{{unknown}}', sample)).toBe('')
    expect(substitute('start {{unknown}} end', sample)).toBe('start  end')
  })
  it('placeholder 없으면 그대로', () => {
    expect(substitute('plain text', sample)).toBe('plain text')
  })
  it('빈/null 안전', () => {
    expect(substitute('', sample)).toBe('')
    expect(substitute('{{recipient_name}}', {})).toBe('')
  })
  it('whitespace 허용', () => {
    expect(substitute('{{ recipient_name }}', sample)).toBe('홍길동')
  })
})

describe('formatDuration', () => {
  it('seconds → 시간/분', () => {
    expect(formatDuration(0)).toBe('—')
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(60)).toBe('1분')
    expect(formatDuration(60 * 30)).toBe('30분')
    expect(formatDuration(60 * 60)).toBe('1시간')
    expect(formatDuration(60 * 60 * 8 + 60 * 30)).toBe('8시간 30분')
    expect(formatDuration(60 * 60 * 2)).toBe('2시간')
  })
})

describe('formatCertDate', () => {
  it('ISO → 한국어', () => {
    expect(formatCertDate('2026-05-06T12:00:00Z')).toMatch(/^2026년 \d{2}월 \d{2}일$/)
  })
  it('null/잘못된 입력 → fallback', () => {
    expect(formatCertDate(null)).toBe('—')
    expect(formatCertDate('not-a-date')).toBe('—')
  })
})
