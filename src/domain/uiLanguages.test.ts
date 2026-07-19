import { describe, expect, it } from 'vitest'
import {
  coerceUiLanguage,
  detectBrowserUiLanguage,
  isUiLanguage
} from './uiLanguages'

describe('uiLanguages', () => {
  it('coerces common aliases', () => {
    expect(coerceUiLanguage('zh-TW')).toBe('zh-HK')
    expect(coerceUiLanguage('zh-CN')).toBe('zh-CN')
    expect(coerceUiLanguage('en-US')).toBe('en')
    expect(coerceUiLanguage('pt')).toBe('pt-BR')
  })

  it('detects browser languages from navigator list', () => {
    const prev = globalThis.navigator
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: { language: 'en-GB', languages: ['en-GB', 'en'] }
    })
    expect(detectBrowserUiLanguage('zh-HK')).toBe('en')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: prev
    })
  })

  it('knows supported ids', () => {
    expect(isUiLanguage('zh-HK')).toBe(true)
    expect(isUiLanguage('xx')).toBe(false)
  })
})
