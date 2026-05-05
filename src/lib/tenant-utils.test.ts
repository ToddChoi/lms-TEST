import { describe, it, expect } from 'vitest'
import { parseSubdomain } from './tenant-utils'

describe('parseSubdomain', () => {
  it('extracts subdomain from 3+ part host', () => {
    expect(parseSubdomain('acme.ingrow.com')).toBe('acme')
    expect(parseSubdomain('hyundai.ingrow.com')).toBe('hyundai')
  })

  it('returns null for apex domain', () => {
    expect(parseSubdomain('ingrow.com')).toBeNull()
  })

  it('returns null for localhost / IP', () => {
    expect(parseSubdomain('localhost')).toBeNull()
    expect(parseSubdomain('localhost:3000')).toBeNull()
    expect(parseSubdomain('127.0.0.1')).toBeNull()
    expect(parseSubdomain('192.168.1.5:3000')).toBeNull()
  })

  it('rejects RESERVED subdomains', () => {
    expect(parseSubdomain('www.ingrow.com')).toBeNull()
    expect(parseSubdomain('app.ingrow.com')).toBeNull()
    expect(parseSubdomain('api.ingrow.com')).toBeNull()
    expect(parseSubdomain('admin.ingrow.com')).toBeNull()
  })

  it('returns null for vercel preview domains', () => {
    expect(parseSubdomain('lms-test-abc.vercel.app')).toBeNull()
  })

  it('handles ports + trims + lowercase', () => {
    expect(parseSubdomain('ACME.ingrow.com:443')).toBe('acme')
    expect(parseSubdomain('  acme.ingrow.com  ')).toBe('acme')
  })

  it('returns null for null/empty', () => {
    expect(parseSubdomain(null)).toBeNull()
    expect(parseSubdomain(undefined)).toBeNull()
    expect(parseSubdomain('')).toBeNull()
  })
})
