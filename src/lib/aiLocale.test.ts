import { describe, expect, it } from 'vitest'
import { getAiLocale } from './aiLocale'

describe('getAiLocale', () => {
  it('defaults empty / unknown Chinese-ish to zh-HK', () => {
    expect(getAiLocale(undefined)).toBe('zh-HK')
    expect(getAiLocale(null)).toBe('zh-HK')
    expect(getAiLocale('')).toBe('zh-HK')
    expect(getAiLocale('zh')).toBe('zh-HK')
    expect(getAiLocale('zh-HK')).toBe('zh-HK')
    expect(getAiLocale('zh_CN')).toBe('zh-HK')
    expect(getAiLocale('zh-TW')).toBe('zh-HK')
    expect(getAiLocale('th')).toBe('zh-HK')
  })

  it('uses English skeleton for non-Chinese UI (output language is separate)', () => {
    expect(getAiLocale('en')).toBe('en')
    expect(getAiLocale('en-US')).toBe('en')
    expect(getAiLocale('es')).toBe('en')
    expect(getAiLocale('ja')).toBe('en')
    expect(getAiLocale('ja-JP')).toBe('en')
    expect(getAiLocale('ru')).toBe('en')
  })
})

import { getGenerationLanguage } from './aiLocale'

describe('getGenerationLanguage', () => {
  it('keeps Japanese (and other UI langs) as output language', () => {
    expect(getGenerationLanguage('ja')).toBe('ja')
    expect(getGenerationLanguage('es')).toBe('es')
    expect(getGenerationLanguage('en')).toBe('en')
    expect(getGenerationLanguage('zh-CN')).toBe('zh-CN')
  })
})

