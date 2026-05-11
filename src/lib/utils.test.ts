import { describe, it, expect } from 'vitest'
import { isEnrollmentActive, isEnrollable } from './utils'

describe('isEnrollmentActive', () => {
  const FUTURE = new Date(Date.now() + 30 * 86400_000).toISOString()
  const PAST = new Date(Date.now() - 86400_000).toISOString()

  it('returns false for null/undefined', () => {
    expect(isEnrollmentActive(null)).toBe(false)
    expect(isEnrollmentActive(undefined)).toBe(false)
  })

  it('returns false when status is not active', () => {
    expect(isEnrollmentActive({ status: 'completed', expires_at: FUTURE })).toBe(false)
    expect(isEnrollmentActive({ status: 'expired', expires_at: FUTURE })).toBe(false)
    expect(isEnrollmentActive({ status: 'cancelled', expires_at: null })).toBe(false)
  })

  it('returns true for active + no expiry', () => {
    expect(isEnrollmentActive({ status: 'active', expires_at: null })).toBe(true)
  })

  it('returns true for active + future expiry', () => {
    expect(isEnrollmentActive({ status: 'active', expires_at: FUTURE })).toBe(true)
  })

  it('returns false for active + past expiry (cron-less expiry guard)', () => {
    expect(isEnrollmentActive({ status: 'active', expires_at: PAST })).toBe(false)
  })
})

describe('isEnrollable', () => {
  const FUTURE = new Date(Date.now() + 30 * 86400_000).toISOString()
  const PAST = new Date(Date.now() - 86400_000).toISOString()

  it('allows when both windows are open or null', () => {
    expect(isEnrollable(null, null)).toBe(true)
    expect(isEnrollable(PAST, FUTURE)).toBe(true)
  })

  it('blocks before enrollStart', () => {
    expect(isEnrollable(FUTURE, null)).toBe(false)
  })

  it('blocks after enrollEnd', () => {
    expect(isEnrollable(null, PAST)).toBe(false)
  })
})
