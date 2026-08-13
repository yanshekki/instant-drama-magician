/**
 * Resolve generation language from the app UI language.
 * Output language is the UI language; template skeleton is zh-HK or en.
 */
import {
  promptTemplateId,
  resolvePromptContext,
  type PromptContext
} from '../prompts'
import type { UiLanguage } from '../domain/uiLanguages'

/** Skeleton language for handwritten system prompts. */
export type AiLocale = 'zh-HK' | 'en'

export function getAiLocale(lang?: string | null): AiLocale {
  return promptTemplateId(lang)
}

export function getPromptContext(lang?: string | null): PromptContext {
  return resolvePromptContext(lang)
}

export function getGenerationLanguage(lang?: string | null): UiLanguage {
  return resolvePromptContext(lang).output
}
