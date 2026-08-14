import { describe, expect, it } from 'vitest'
import { getAiLocale, getGenerationLanguage } from './aiLocale'

describe('getAiLocale', () => {
  it('defaults empty / unknown to zh-HK', () => {
    expect(getAiLocale(undefined)).toBe('zh-HK')
    expect(getAiLocale(null)).toBe('zh-HK')
    expect(getAiLocale('')).toBe('zh-HK')
    expect(getAiLocale('zh')).toBe('zh-HK')
    expect(getAiLocale('zh-HK')).toBe('zh-HK')
    expect(getAiLocale('zh-TW')).toBe('zh-HK')
    expect(getAiLocale('th')).toBe('zh-HK')
  })

  it('keeps all ten UI languages (no en/zh collapse)', () => {
    expect(getAiLocale('en')).toBe('en')
    expect(getAiLocale('en-US')).toBe('en')
    expect(getAiLocale('zh_CN')).toBe('zh-CN')
    expect(getAiLocale('zh-CN')).toBe('zh-CN')
    expect(getAiLocale('es')).toBe('es')
    expect(getAiLocale('ja')).toBe('ja')
    expect(getAiLocale('ja-JP')).toBe('ja')
    expect(getAiLocale('ru')).toBe('ru')
    expect(getAiLocale('fr')).toBe('fr')
    expect(getAiLocale('pt-BR')).toBe('pt-BR')
    expect(getAiLocale('hi')).toBe('hi')
    expect(getAiLocale('ar')).toBe('ar')
  })
})

describe('getGenerationLanguage', () => {
  it('keeps Japanese (and other UI langs) as output language', () => {
    expect(getGenerationLanguage('ja')).toBe('ja')
    expect(getGenerationLanguage('es')).toBe('es')
    expect(getGenerationLanguage('en')).toBe('en')
    expect(getGenerationLanguage('zh-CN')).toBe('zh-CN')
  })
})
