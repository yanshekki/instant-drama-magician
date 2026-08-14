import { coerceUiLanguage } from '../domain/uiLanguages'
import { PROMPT_PACKS } from './packs'
import type {
  HardRuleKind,
  HardRuleTags,
  PromptContext,
  PromptPack,
  PromptTemplateId
} from './types'

export function selectPromptPack(lang: string | null | undefined): PromptPack {
  return PROMPT_PACKS[coerceUiLanguage(lang, 'zh-HK')]
}

export function generationLanguageName(lang: string | null | undefined): string {
  return selectPromptPack(lang).languageName
}

export function hardRuleTags(lang: string | null | undefined): HardRuleTags {
  return selectPromptPack(lang).tags
}

/**
 * @deprecated Prefer PromptCatalog.t(locale, key).
 * Legacy binary skeleton: Chinese family vs everyone else.
 */
export function promptTemplateId(lang: string | null | undefined): PromptTemplateId {
  const id = coerceUiLanguage(lang, 'zh-HK')
  return id === 'zh-HK' || id === 'zh-CN' ? 'zh-HK' : 'en'
}

export function outputLanguageLock(lang: string | null | undefined): string {
  return selectPromptPack(lang).outputLock
}

export function imagePolishDirective(lang: string | null | undefined): string {
  return selectPromptPack(lang).imagePolishDirective
}

export function noRefPolishDirective(lang: string | null | undefined): string {
  return selectPromptPack(lang).noRefPolishDirective
}

export function videoPolishDirective(lang: string | null | undefined): string {
  return selectPromptPack(lang).videoPolishDirective
}

export function resolvePromptContext(
  lang?: string | null
): PromptContext {
  const output = coerceUiLanguage(lang, 'zh-HK')
  const pack = selectPromptPack(output)
  return {
    output,
    template: promptTemplateId(output),
    pack,
    languageName: pack.languageName,
    tags: pack.tags,
    outputLock: pack.outputLock,
    imagePolishDirective: pack.imagePolishDirective,
    noRefPolishDirective: pack.noRefPolishDirective,
    videoPolishDirective: pack.videoPolishDirective
  }
}

export function packHardRulesFallback(
  kind: HardRuleKind,
  lang?: string | null
): string {
  return resolvePromptContext(lang).pack.hardRulesFallback[kind]
}

export function packHardRulesInstruction(lang?: string | null): string {
  return resolvePromptContext(lang).pack.hardRulesInstruction
}
