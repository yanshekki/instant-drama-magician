/**
 * Map UI language, character spoken codes, and LLM language hints
 * onto the ten supported generation locales.
 */
import {
  coerceUiLanguage,
  isUiLanguage,
  type UiLanguage
} from './uiLanguages'
import { normalizeLanguageCodes } from './worldLanguages'

export const GENERATION_LOCALES: readonly UiLanguage[] = [
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
] as const

/** Spoken / BCP-47 / free-text → one of the ten UI locales. */
export function spokenCodeToUiLanguage(
  code: string | null | undefined,
  fallback: UiLanguage = 'zh-HK'
): UiLanguage {
  const raw = (code || '').trim()
  if (!raw) return fallback
  if (isUiLanguage(raw)) return raw
  const n = normalizeLanguageCodes(raw)
  const c = (n[0] || raw).toLowerCase().replace(/_/g, '-')
  if (c === 'yue' || c === 'zh-hant' || c === 'zh-tw' || c === 'zh-hk') {
    return 'zh-HK'
  }
  if (
    c === 'cmn' ||
    c === 'zh-hans' ||
    c === 'zh-cn' ||
    c === 'zh-sg' ||
    c === 'zh'
  ) {
    return 'zh-CN'
  }
  if (c === 'ja' || c.startsWith('ja-')) return 'ja'
  if (c === 'en' || c.startsWith('en-')) return 'en'
  if (c === 'es' || c.startsWith('es-')) return 'es'
  if (c === 'hi' || c.startsWith('hi-')) return 'hi'
  if (c === 'ar' || c.startsWith('ar-')) return 'ar'
  if (c === 'pt' || c.startsWith('pt-')) return 'pt-BR'
  if (c === 'fr' || c.startsWith('fr-')) return 'fr'
  if (c === 'ru' || c.startsWith('ru-')) return 'ru'
  return coerceUiLanguage(raw, fallback)
}

/** Cheap script / keyword detector for LLM replies. */
export function detectLocaleFromText(
  text: string | null | undefined
): UiLanguage | null {
  const s = (text || '').trim()
  if (!s) return null
  const lower = s.toLowerCase()
  if (/[\u3040-\u30ff]/.test(s)) return 'ja'
  if (/[\u0400-\u04ff]/.test(s)) return 'ru'
  if (/[\u0600-\u06ff]/.test(s)) return 'ar'
  if (/[\u0900-\u097f]/.test(s)) return 'hi'
  if (/[\u4e00-\u9fff]/.test(s)) {
    if (/係|嘅|唔|佢|喺|咗|嚟/.test(s)) return 'zh-HK'
    if (/这|那|吗|为|个|们|说/.test(s)) return 'zh-CN'
    return 'zh-HK'
  }
  if (/\b(cantonese|yue|zh-hk|zh-hant)\b/.test(lower)) return 'zh-HK'
  if (/\b(mandarin|putonghua|zh-cn|zh-hans|cmn)\b/.test(lower)) return 'zh-CN'
  if (/\b(japanese|nihongo|ja)\b/.test(lower)) return 'ja'
  if (/\b(spanish|espa[nñ]ol|es)\b/.test(lower)) return 'es'
  if (/\b(french|fran[cç]ais|fr)\b/.test(lower)) return 'fr'
  if (/\b(portuguese|portugu[eê]s|pt-br|pt)\b/.test(lower)) return 'pt-BR'
  if (/\b(hindi|हिन्दी)\b/.test(lower)) return 'hi'
  if (/\b(arabic|عربي)\b/.test(lower)) return 'ar'
  if (/\b(russian|русский)\b/.test(lower)) return 'ru'
  if (/\b(english|en-us|en-gb)\b/.test(lower) && /^[\x00-\x7F]+$/.test(s)) {
    return 'en'
  }
  return null
}

export function resolveGenerationLocale(input?: {
  spokenLanguages?: string | string[] | null
  llmHint?: string | null
  uiLanguage?: string | null
  fallback?: UiLanguage
}): UiLanguage {
  const fallback = input?.fallback ?? 'zh-HK'
  const spoken = Array.isArray(input?.spokenLanguages)
    ? input?.spokenLanguages ?? []
    : normalizeLanguageCodes(input?.spokenLanguages ?? '')
  if (spoken[0]) return spokenCodeToUiLanguage(spoken[0], fallback)
  const fromLlm = detectLocaleFromText(input?.llmHint)
  if (fromLlm) return fromLlm
  if (input?.uiLanguage) return coerceUiLanguage(input.uiLanguage, fallback)
  return fallback
}
