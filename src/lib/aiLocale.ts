/**
 * Resolve generation language from the app UI language.
 * Uses the full 10-language PromptCatalog locale — no en/zh collapse.
 */
import { coerceUiLanguage, type UiLanguage } from '../domain/uiLanguages'
import { resolvePromptContext, type PromptContext } from '../prompts'

/** Generation locale — same 10 codes as the UI. */
export type AiLocale = UiLanguage

export function getAiLocale(lang?: string | null): AiLocale {
  return coerceUiLanguage(lang, 'zh-HK')
}

export function getPromptContext(lang?: string | null): PromptContext {
  return resolvePromptContext(lang)
}

export function getGenerationLanguage(lang?: string | null): UiLanguage {
  return coerceUiLanguage(lang, 'zh-HK')
}
