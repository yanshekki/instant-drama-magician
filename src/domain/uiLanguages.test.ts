import { describe, expect, it } from 'vitest'
import {
  UI_LANGUAGES,
  coerceUiLanguage,
  isRtlLanguage,
  isUiLanguage,
  uiLanguageMeta
} from './uiLanguages'

describe('uiLanguages', () => {
  it('defines exactly 10 global languages', () => {
    expect(UI_LANGUAGES).toHaveLength(10)
    const ids = UI_LANGUAGES.map((l) => l.id)
    expect(new Set(ids).size).toBe(10)
    expect(ids).toEqual([
      'en',
      'zh-HK',
      'zh-CN',
      'es',
      'hi',
      'ar',
      'pt-BR',
      'fr',
      'ja',
      'ru'
    ])
  })

  it('coerces aliases and invalid values', () => {
    expect(coerceUiLanguage('en')).toBe('en')
    expect(coerceUiLanguage('zh-CN')).toBe('zh-CN')
    expect(coerceUiLanguage('zh-TW')).toBe('zh-HK')
    expect(coerceUiLanguage('pt')).toBe('pt-BR')
    expect(coerceUiLanguage('es-MX')).toBe('es')
    expect(coerceUiLanguage('nope', 'en')).toBe('en')
  })

  it('marks Arabic as RTL', () => {
    expect(isRtlLanguage('ar')).toBe(true)
    expect(isRtlLanguage('en')).toBe(false)
    expect(uiLanguageMeta('ja').nativeLabel).toBe('日本語')
  })

  it('type guard', () => {
    expect(isUiLanguage('fr')).toBe(true)
    expect(isUiLanguage('de')).toBe(false)
  })
})
