import { describe, expect, it } from 'vitest'
import { getAiLocale } from './aiLocale'

describe('getAiLocale', () => {
  it('maps Chinese UI to zh-HK prompts', () => {
    expect(getAiLocale('zh-HK')).toBe('zh-HK')
    expect(getAiLocale('zh-CN')).toBe('zh-HK')
    expect(getAiLocale('zh-TW')).toBe('zh-HK')
  })

  it('maps other UI languages to English prompts', () => {
    expect(getAiLocale('en')).toBe('en')
    expect(getAiLocale('es')).toBe('en')
    expect(getAiLocale('ja')).toBe('en')
    expect(getAiLocale('ar')).toBe('en')
    expect(getAiLocale('pt-BR')).toBe('en')
  })
})
