import { describe, it, expect } from 'vitest'
import { matchesAudience, type AudienceContext } from './audience-eval'

const anon: AudienceContext = {
  userId: null,
  role: null,
  interests: [],
  jobLevel: null,
  memberships: [],
  tenantId: null,
}

const acmeStaff: AudienceContext = {
  userId: 'u1',
  role: 'student',
  interests: ['ai', 'data'],
  jobLevel: 'staff',
  memberships: [{ company_id: 'acme', is_manager: false }],
  tenantId: null,
}

const acmeMgr: AudienceContext = {
  ...acmeStaff,
  userId: 'u2',
  jobLevel: 'manager',
  memberships: [{ company_id: 'acme', is_manager: true }],
}

const studentNoCompany: AudienceContext = {
  userId: 'u3',
  role: 'student',
  interests: [],
  jobLevel: null,
  memberships: [],
  tenantId: null,
}

describe('matchesAudience — 비조건', () => {
  it('audience 비어있으면 항상 통과', () => {
    expect(matchesAudience(undefined, anon)).toBe(true)
    expect(matchesAudience(null, anon)).toBe(true)
    expect(matchesAudience({}, anon)).toBe(true)
  })
})

describe('matchesAudience — logged_in', () => {
  it('logged_in: true → 비로그인 차단', () => {
    expect(matchesAudience({ logged_in: true }, anon)).toBe(false)
    expect(matchesAudience({ logged_in: true }, acmeStaff)).toBe(true)
  })
  it('logged_in: false → 로그인 차단', () => {
    expect(matchesAudience({ logged_in: false }, anon)).toBe(true)
    expect(matchesAudience({ logged_in: false }, acmeStaff)).toBe(false)
  })
})

describe('matchesAudience — company', () => {
  it('company_id 매칭 → 해당 회사 멤버만', () => {
    expect(matchesAudience({ company_id: 'acme' }, anon)).toBe(false)
    expect(matchesAudience({ company_id: 'acme' }, acmeStaff)).toBe(true)
    expect(matchesAudience({ company_id: 'other' }, acmeStaff)).toBe(false)
  })
  it('is_company_member: true → 어떤 회사든 멤버', () => {
    expect(matchesAudience({ is_company_member: true }, anon)).toBe(false)
    expect(matchesAudience({ is_company_member: true }, acmeStaff)).toBe(true)
    expect(matchesAudience({ is_company_member: true }, studentNoCompany)).toBe(false)
  })
  it('is_company_member: false → 비멤버만', () => {
    expect(matchesAudience({ is_company_member: false }, studentNoCompany)).toBe(true)
    expect(matchesAudience({ is_company_member: false }, acmeStaff)).toBe(false)
  })
  it('is_company_manager: true → 매니저만', () => {
    expect(matchesAudience({ is_company_manager: true }, acmeMgr)).toBe(true)
    expect(matchesAudience({ is_company_manager: true }, acmeStaff)).toBe(false)
  })
})

describe('matchesAudience — role / interests / job_level', () => {
  it('roles 매칭', () => {
    expect(matchesAudience({ roles: ['admin'] }, acmeStaff)).toBe(false)
    expect(matchesAudience({ roles: ['student', 'admin'] }, acmeStaff)).toBe(true)
  })
  it('interests_any 교집합 1개라도', () => {
    expect(matchesAudience({ interests_any: ['ai'] }, acmeStaff)).toBe(true)
    expect(matchesAudience({ interests_any: ['ai', 'design'] }, acmeStaff)).toBe(true)
    expect(matchesAudience({ interests_any: ['design'] }, acmeStaff)).toBe(false)
    expect(matchesAudience({ interests_any: ['ai'] }, studentNoCompany)).toBe(false)
  })
  it('job_levels', () => {
    expect(matchesAudience({ job_levels: ['manager'] }, acmeMgr)).toBe(true)
    expect(matchesAudience({ job_levels: ['manager'] }, acmeStaff)).toBe(false)
    expect(matchesAudience({ job_levels: ['staff', 'manager'] }, acmeStaff)).toBe(true)
  })
})

describe('matchesAudience — AND 결합', () => {
  it('모든 조건 통과 시만 true', () => {
    const a = { logged_in: true, company_id: 'acme', is_company_manager: true }
    expect(matchesAudience(a, acmeMgr)).toBe(true)
    expect(matchesAudience(a, acmeStaff)).toBe(false) // not manager
    expect(matchesAudience(a, anon)).toBe(false)      // not logged
  })
})
