import { describe, it, expect } from 'vitest'
import { parseAttendeesCsv } from './csv-attendees'

describe('parseAttendeesCsv', () => {
  it('parses basic CSV with English headers', () => {
    const csv = `name,email,phone\nAlice,alice@example.com,010-1111-1111\nBob,bob@example.com,010-2222-2222`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows).toHaveLength(2)
    expect(r.rows[0].name).toBe('Alice')
    expect(r.rows[1].email).toBe('bob@example.com')
  })

  it('parses Korean headers', () => {
    const csv = `이름,이메일,전화,부서,직책\n홍길동,hong@x.com,010-0000-0000,개발팀,선임`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows[0].name).toBe('홍길동')
    expect(r.rows[0].department).toBe('개발팀')
  })

  it('handles BOM at start', () => {
    const csv = `﻿name\nAlice`
    const r = parseAttendeesCsv(csv)
    expect(r.ok).toBe(true)
  })

  it('blocks CSV injection — = prefix', () => {
    const csv = `name,email\n=CMD|"calc",alice@x.com`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows[0].name.startsWith("'")).toBe(true)
  })

  it('blocks CSV injection — + / - / @ prefix', () => {
    const csv = `name\n+1\n-cmd\n@formula`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows[0].name).toBe("'+1")
    expect(r.rows[1].name).toBe("'-cmd")
    expect(r.rows[2].name).toBe("'@formula")
  })

  it('handles quoted cells with comma inside', () => {
    const csv = `name,department\n"Smith, John",HR`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows[0].name).toBe('Smith, John')
  })

  it('rejects when required name header missing', () => {
    const csv = `email,phone\nalice@x.com,010`
    const r = parseAttendeesCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/name/)
  })

  it('rejects row with empty name', () => {
    const csv = `name,email\n,alice@x.com\nBob,bob@x.com`
    const r = parseAttendeesCsv(csv)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.lineNumber).toBe(2)
  })

  it('rejects empty CSV', () => {
    const r = parseAttendeesCsv('')
    expect(r.ok).toBe(false)
  })

  it('rejects when row count exceeds limit', () => {
    const rows = ['name', ...Array.from({ length: 501 }, (_, i) => `Person${i}`)].join('\n')
    const r = parseAttendeesCsv(rows)
    expect(r.ok).toBe(false)
    if (r.ok) return
    expect(r.error).toMatch(/너무 많/)
  })

  it('returns null for empty optional fields', () => {
    const csv = `name,email\nAlice,`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows[0].email).toBeNull()
  })

  it('handles CRLF line endings', () => {
    const csv = `name\r\nAlice\r\nBob`
    const r = parseAttendeesCsv(csv)
    if (!r.ok) throw new Error(r.error)
    expect(r.rows).toHaveLength(2)
  })
})
