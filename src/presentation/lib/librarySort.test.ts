import { describe, expect, it } from 'vitest'
import {
  compareUpdatedAtDesc,
  parseUpdatedAtMs,
  sortByUpdatedAtDesc
} from './librarySort'

describe('parseUpdatedAtMs', () => {
  it('parses Date, ISO, SQL datetime, number ms, numeric string ms', () => {
    const iso = '2026-07-20T17:48:05.770Z'
    const ms = Date.parse(iso)
    expect(parseUpdatedAtMs(new Date(iso))).toBe(ms)
    expect(parseUpdatedAtMs(iso)).toBe(ms)
    expect(parseUpdatedAtMs(ms)).toBe(ms)
    expect(parseUpdatedAtMs(String(ms))).toBe(ms)
    expect(parseUpdatedAtMs('2026-07-20 17:41:17')).toBeGreaterThan(0)
  })

  it('returns 0 for invalid / empty', () => {
    expect(parseUpdatedAtMs(null)).toBe(0)
    expect(parseUpdatedAtMs(undefined)).toBe(0)
    expect(parseUpdatedAtMs('')).toBe(0)
    expect(parseUpdatedAtMs('not-a-date')).toBe(0)
    expect(parseUpdatedAtMs({})).toBe(0)
  })
})

describe('compareUpdatedAtDesc / sortByUpdatedAtDesc', () => {
  it('orders newest updatedAt first', () => {
    const items = [
      { id: 'old', name: 'A', updatedAt: '2026-01-01T00:00:00.000Z' },
      { id: 'new', name: 'Z', updatedAt: '2026-07-20T12:00:00.000Z' },
      { id: 'mid', name: 'M', updatedAt: '2026-03-01T00:00:00.000Z' }
    ]
    expect(sortByUpdatedAtDesc(items).map((x) => x.id)).toEqual([
      'new',
      'mid',
      'old'
    ])
  })

  it('handles numeric-string timestamps (SQLite raw ms)', () => {
    const items = [
      { id: 'a', updatedAt: '1000' },
      { id: 'b', updatedAt: '3000' },
      { id: 'c', updatedAt: '2000' }
    ]
    expect(sortByUpdatedAtDesc(items).map((x) => x.id)).toEqual([
      'b',
      'c',
      'a'
    ])
  })

  it('falls back to createdAt when updatedAt missing', () => {
    const items = [
      { id: 'a', createdAt: '2026-01-01T00:00:00.000Z' },
      { id: 'b', createdAt: '2026-06-01T00:00:00.000Z' }
    ]
    expect(sortByUpdatedAtDesc(items).map((x) => x.id)).toEqual(['b', 'a'])
  })

  it('never returns NaN from comparator', () => {
    const r = compareUpdatedAtDesc(
      { id: 'a', updatedAt: 'bad' },
      { id: 'b', updatedAt: {} }
    )
    expect(Number.isNaN(r)).toBe(false)
  })
})
