import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  UI_LANGUAGE_STORAGE_KEY,
  UI_LANGUAGES,
  applyDocumentDirection,
  coerceUiLanguage,
  detectBrowserUiLanguage,
  isRtlLanguage,
  isUiLanguage,
  readStoredUiLanguage,
  uiLanguageMeta,
  writeStoredUiLanguage
} from './uiLanguages'

describe('uiLanguages', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('lists top languages including Arabic rtl', () => {
    expect(UI_LANGUAGES.length).toBe(10)
    expect(UI_LANGUAGES.find((l) => l.id === 'ar')?.rtl).toBe(true)
  })

  it('coerces common aliases', () => {
    expect(coerceUiLanguage('zh-TW')).toBe('zh-HK')
    expect(coerceUiLanguage('zh')).toBe('zh-HK')
    expect(coerceUiLanguage('zh-hant')).toBe('zh-HK')
    expect(coerceUiLanguage('zh-CN')).toBe('zh-CN')
    expect(coerceUiLanguage('zh-hans')).toBe('zh-CN')
    expect(coerceUiLanguage('zh-sg')).toBe('zh-CN')
    expect(coerceUiLanguage('en-US')).toBe('en')
    expect(coerceUiLanguage('pt')).toBe('pt-BR')
    expect(coerceUiLanguage('es-MX')).toBe('es')
    expect(coerceUiLanguage('hi-IN')).toBe('hi')
    expect(coerceUiLanguage('ar-SA')).toBe('ar')
    expect(coerceUiLanguage('fr-FR')).toBe('fr')
    expect(coerceUiLanguage('ja-JP')).toBe('ja')
    expect(coerceUiLanguage('ru-RU')).toBe('ru')
    expect(coerceUiLanguage('xx', 'en')).toBe('en')
    expect(coerceUiLanguage(null)).toBe('zh-HK')
    expect(coerceUiLanguage('en')).toBe('en')
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
      value: { language: 'ja', languages: ['ja'] }
    })
    expect(detectBrowserUiLanguage()).toBe('ja')
    Object.defineProperty(globalThis, 'navigator', {
      configurable: true,
      value: prev
    })
  })

  it('detectBrowserUiLanguage falls back without navigator', () => {
    vi.stubGlobal('navigator', undefined)
    expect(detectBrowserUiLanguage('en')).toBe('en')
  })

  it('knows supported ids', () => {
    expect(isUiLanguage('zh-HK')).toBe(true)
    expect(isUiLanguage('xx')).toBe(false)
    expect(isUiLanguage(null)).toBe(false)
  })

  it('read/write stored language via localStorage', () => {
    const map = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => {
        map.set(k, v)
      }
    })
    expect(readStoredUiLanguage()).toBeNull()
    writeStoredUiLanguage('ja')
    expect(map.get(UI_LANGUAGE_STORAGE_KEY)).toBe('ja')
    expect(readStoredUiLanguage()).toBe('ja')
    map.set(UI_LANGUAGE_STORAGE_KEY, 'nope')
    expect(readStoredUiLanguage()).toBeNull()
  })

  it('handles missing / throwing localStorage', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readStoredUiLanguage()).toBeNull()
    writeStoredUiLanguage('en')

    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('quota')
      },
      setItem: () => {
        throw new Error('quota')
      }
    })
    expect(readStoredUiLanguage()).toBeNull()
    writeStoredUiLanguage('en')
  })

  it('uiLanguageMeta and rtl helpers', () => {
    expect(uiLanguageMeta('ar').rtl).toBe(true)
    expect(uiLanguageMeta('en').id).toBe('en')
    expect(uiLanguageMeta('unknown').id).toBe('zh-HK')
    expect(isRtlLanguage('ar')).toBe(true)
    expect(isRtlLanguage('en')).toBe(false)
  })

  it('applyDocumentDirection sets lang and dir', () => {
    const root = { lang: '', dir: '' }
    vi.stubGlobal('document', { documentElement: root })
    applyDocumentDirection('ar')
    expect(root.lang).toBe('ar')
    expect(root.dir).toBe('rtl')
    applyDocumentDirection('en')
    expect(root.dir).toBe('ltr')
    vi.stubGlobal('document', undefined)
    applyDocumentDirection('ar')
  })
})
