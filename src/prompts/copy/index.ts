import type { UiLanguage } from '../../domain/uiLanguages'
import { coerceUiLanguage } from '../../domain/uiLanguages'
import type { PromptCopyTable } from './keys'
import { arPromptCopy } from './ar'
import { enPromptCopy } from './en'
import { esPromptCopy } from './es'
import { frPromptCopy } from './fr'
import { hiPromptCopy } from './hi'
import { jaPromptCopy } from './ja'
import { ptBrPromptCopy } from './pt-BR'
import { ruPromptCopy } from './ru'
import { zhCnPromptCopy } from './zh-CN'
import { zhHkPromptCopy } from './zh-HK'

export const PROMPT_COPY: Record<UiLanguage, PromptCopyTable> = {
  en: enPromptCopy,
  'zh-HK': zhHkPromptCopy,
  'zh-CN': zhCnPromptCopy,
  es: esPromptCopy,
  hi: hiPromptCopy,
  ar: arPromptCopy,
  'pt-BR': ptBrPromptCopy,
  fr: frPromptCopy,
  ja: jaPromptCopy,
  ru: ruPromptCopy
}

export function promptCopyTable(lang?: string | null): PromptCopyTable {
  return PROMPT_COPY[coerceUiLanguage(lang, 'zh-HK')]
}

export { PROMPT_COPY_KEYS, type PromptCopyKey, type PromptCopyTable } from './keys'
