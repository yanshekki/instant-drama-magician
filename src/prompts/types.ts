import type { UiLanguage } from '../domain/uiLanguages'

export type PromptTemplateId = 'en' | 'zh-HK'

export type HardRuleKind =
  | 'story'
  | 'character'
  | 'scene'
  | 'prop'
  | 'action'
  | 'costume'

export type HardRuleTags = {
  must: string
  mustNot: string
}

export type PromptPack = {
  id: UiLanguage
  languageName: string
  tags: HardRuleTags
  outputLock: string
  imagePolishDirective: string
  /** When polish has zero attached stills — forbid invented refs / web search. */
  noRefPolishDirective: string
  /** Front-load when profile sex is male — Imagine otherwise defaults to female. */
  sexLockMale: string
  sexLockFemale: string
  sexForbidMale: string
  sexForbidFemale: string
  videoPolishDirective: string
  hardRulesInstruction: string
  hardRulesFallback: Record<HardRuleKind, string>
}

export type PromptContext = {
  /** UI / output language — field values and gen prompts. */
  output: UiLanguage
  /** Which handwritten skeleton to use. */
  template: PromptTemplateId
  pack: PromptPack
  languageName: string
  tags: HardRuleTags
  outputLock: string
  imagePolishDirective: string
  noRefPolishDirective: string
  videoPolishDirective: string
}
