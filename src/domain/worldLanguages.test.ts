import { describe, expect, it } from 'vitest'
import {
  listWorldLanguages,
  normalizeLanguageCodes,
  parseSpokenLanguagesJson,
  serializeSpokenLanguages
} from './worldLanguages'

describe('worldLanguages', () => {
  it('lists a full catalog including major + regional codes', () => {
    const list = listWorldLanguages('zh-HK')
    expect(list.length).toBeGreaterThan(150)
    const codes = new Set(list.map((o) => o.code))
    expect(codes.has('yue')).toBe(true)
    expect(codes.has('en')).toBe(true)
    expect(codes.has('ja')).toBe(true)
    expect(codes.has('zu')).toBe(true)
  })

  it('normalizes aliases and codes', () => {
    expect(normalizeLanguageCodes(['粵語', 'english', 'ja'])).toEqual([
      'yue',
      'en',
      'ja'
    ])
    expect(normalizeLanguageCodes('yue, en / 普通話')).toEqual([
      'yue',
      'en',
      'cmn'
    ])
  })

  it('round-trips JSON storage', () => {
    const json = serializeSpokenLanguages(['yue', 'en', 'unknown-lang'])
    expect(json).toBe(JSON.stringify(['yue', 'en']))
    expect(parseSpokenLanguagesJson(json)).toEqual(['yue', 'en'])
    expect(parseSpokenLanguagesJson(null)).toEqual([])
  })
})
