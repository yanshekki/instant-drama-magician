import { describe, expect, it } from 'vitest'
import {
  WORLD_LANGUAGE_CODES,
  languageLabel,
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
    expect(WORLD_LANGUAGE_CODES.length).toBe(list.length)
  })

  it('lists english labels for en UI', () => {
    const list = listWorldLanguages('en')
    const yue = list.find((o) => o.code === 'yue')
    expect(yue?.label).toMatch(/Cantonese|Yue/i)
  })

  it('languageLabel prefers tuned sinitic labels', () => {
    expect(languageLabel('yue', 'zh-HK')).toMatch(/粵語/)
    expect(languageLabel('yue', 'en')).toMatch(/Cantonese|Yue/i)
    expect(languageLabel('en', 'en')).toMatch(/English/i)
    // Unknown codes fall back via Intl or raw code
    expect(languageLabel('not-a-real-lang-code', 'en').length).toBeGreaterThan(0)
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
    expect(normalizeLanguageCodes(null)).toEqual([])
    expect(normalizeLanguageCodes(['EN', 'YUE', 'yue'])).toEqual(['en', 'yue'])
  })

  it('round-trips JSON storage', () => {
    const json = serializeSpokenLanguages(['yue', 'en', 'unknown-lang'])
    expect(json).toBe(JSON.stringify(['yue', 'en']))
    expect(parseSpokenLanguagesJson(json)).toEqual(['yue', 'en'])
    expect(parseSpokenLanguagesJson(null)).toEqual([])
    expect(parseSpokenLanguagesJson('not-json')).toEqual([])
    expect(parseSpokenLanguagesJson('[]')).toEqual([])
  })
})
