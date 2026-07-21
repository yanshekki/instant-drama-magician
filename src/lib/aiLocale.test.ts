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

  it('maps other UI languages to English prompts', () => {
    expect(getAiLocale('en')).toBe('en')
    expect(getAiLocale('en-US')).toBe('en')
    expect(getAiLocale('es')).toBe('en')
    expect(getAiLocale('hi')).toBe('en')
    expect(getAiLocale('ar')).toBe('en')
    expect(getAiLocale('pt-BR')).toBe('en')
    expect(getAiLocale('fr')).toBe('en')
    expect(getAiLocale('ja')).toBe('en')
    expect(getAiLocale('ja-JP')).toBe('en')
    expect(getAiLocale('ru')).toBe('en')
    expect(getAiLocale('de')).toBe('en')
    expect(getAiLocale('ko')).toBe('en')
  })
})
