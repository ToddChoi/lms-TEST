import { describe, it, expect } from 'vitest'
import { calculateRefund, daysUntil } from './refund-policy'

const POLICY = { full_refund_days_before: 7, half_refund_days_before: 3 }

describe('daysUntil', () => {
  it('returns positive days for future date', () => {
    const now = new Date('2026-06-01T05:00:00+09:00')  // KST
    const days = daysUntil('2026-06-08', now)
    expect(days).toBe(7)
  })

  it('returns 0 for same KST day', () => {
    const now = new Date('2026-06-01T23:30:00+09:00')
    expect(daysUntil('2026-06-01', now)).toBe(0)
  })

  it('returns negative for past date', () => {
    const now = new Date('2026-06-10T00:00:00+09:00')
    expect(daysUntil('2026-06-01', now)).toBe(-9)
  })
})

describe('calculateRefund', () => {
  it('100% — exactly full_refund_days_before days out', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-08', POLICY, now)
    expect(r.rate).toBe(100)
    expect(r.amount).toBe(100_000)
    expect(r.reason).toBe('full_refund_window')
  })

  it('100% — more than full_refund days out', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(50_000, '2026-06-30', POLICY, now)
    expect(r.rate).toBe(100)
  })

  it('50% — between full and half windows (e.g., 3-6 days out)', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-05', POLICY, now)
    expect(r.rate).toBe(50)
    expect(r.amount).toBe(50_000)
  })

  it('50% — exactly half_refund_days_before days out', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-04', POLICY, now)
    expect(r.rate).toBe(50)
  })

  it('0% — within half window (1-2 days)', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-02', POLICY, now)
    expect(r.rate).toBe(0)
    expect(r.amount).toBe(0)
  })

  it('0% — same day', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-01', POLICY, now)
    expect(r.rate).toBe(0)
  })

  it('0% — past start date', () => {
    const now = new Date('2026-06-10T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-01', POLICY, now)
    expect(r.rate).toBe(0)
  })

  it('floors 50% to integer', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(99_999, '2026-06-05', POLICY, now)
    expect(r.amount).toBe(49_999)  // floor(99999 * 0.5) = 49999
  })

  it('respects custom policy', () => {
    const customPolicy = { full_refund_days_before: 14, half_refund_days_before: 7 }
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-10', customPolicy, now)
    expect(r.rate).toBe(50)  // 9 days out, between 14 and 7
  })

  it('handles ISO datetime as session start', () => {
    const now = new Date('2026-06-01T10:00:00+09:00')
    const r = calculateRefund(100_000, '2026-06-10T00:00:00+09:00', POLICY, now)
    expect(r.rate).toBe(100)
  })
})
