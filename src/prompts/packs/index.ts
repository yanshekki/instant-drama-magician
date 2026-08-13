import type { UiLanguage } from '../../domain/uiLanguages'
import type { PromptPack } from '../types'
import { arPromptPack } from './ar'
import { enPromptPack } from './en'
import { esPromptPack } from './es'
import { frPromptPack } from './fr'
import { hiPromptPack } from './hi'
import { jaPromptPack } from './ja'
import { ptBrPromptPack } from './pt-BR'
import { ruPromptPack } from './ru'
import { zhCnPromptPack } from './zh-CN'
import { zhHkPromptPack } from './zh-HK'

export const PROMPT_PACKS: Record<UiLanguage, PromptPack> = {
  en: enPromptPack,
  'zh-HK': zhHkPromptPack,
  'zh-CN': zhCnPromptPack,
  es: esPromptPack,
  hi: hiPromptPack,
  ar: arPromptPack,
  'pt-BR': ptBrPromptPack,
  fr: frPromptPack,
  ja: jaPromptPack,
  ru: ruPromptPack
}

export {
  arPromptPack,
  enPromptPack,
  esPromptPack,
  frPromptPack,
  hiPromptPack,
  jaPromptPack,
  ptBrPromptPack,
  ruPromptPack,
  zhCnPromptPack,
  zhHkPromptPack
}
