import { describe, it, expect } from 'vitest'
import { calculateAttendanceRate, attendanceRateFromRows } from './attendance-rate'

describe('calculateAttendanceRate', () => {
  it('100% all present', () => {
    expect(calculateAttendanceRate(5, 5)).toBe(100)
  })
  it('0% none present', () => {
    expect(calculateAttendanceRate(0, 5)).toBe(0)
  })
  it('rounds 50%', () => {
    expect(calculateAttendanceRate(1, 2)).toBe(50)
  })
  it('handles 0 totalDays', () => {
    expect(calculateAttendanceRate(0, 0)).toBe(0)
  })
  it('rounds 33% to 33', () => {
    expect(calculateAttendanceRate(1, 3)).toBe(33)
  })
  it('rounds 67% to 67', () => {
    expect(calculateAttendanceRate(2, 3)).toBe(67)
  })
})

describe('attendanceRateFromRows', () => {
  it('counts present and late together', () => {
    const r = attendanceRateFromRows(
      [{ status: 'present' }, { status: 'late' }, { status: 'absent' }],
      3
    )
    expect(r.present).toBe(2)
    expect(r.total).toBe(3)
    expect(r.rate).toBe(67)
  })
  it('returns 0 when no rows + totalDays', () => {
    const r = attendanceRateFromRows([], 5)
    expect(r.present).toBe(0)
    expect(r.rate).toBe(0)
  })
})
