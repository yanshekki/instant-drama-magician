/**
 * User-chosen LLM recipes. Hidden defaults stay off unless the template
 * explicitly turns them on.
 */
import { PromptCatalog } from '../prompts'

export type PromptTemplateFamily = 'copy' | 'media'

export const COPY_TEMPLATE_IDS = [
  'polish-only',
  'fill-blanks',
  'invent',
  'from-story'
] as const

export const MEDIA_TEMPLATE_IDS = [
  'follow-asset',
  'cinematic-lock',
  'identity-lock',
  'restyle'
] as const

export type CopyTemplateId = (typeof COPY_TEMPLATE_IDS)[number]
export type MediaTemplateId = (typeof MEDIA_TEMPLATE_IDS)[number]
export type PromptTemplateId = CopyTemplateId | MediaTemplateId

export type PromptTemplateFlags = {
  inventWorld: boolean
  fillOnlyEmpty: boolean
  injectStory: boolean
  persistHardRulesFallback: boolean
  speechLockIfEmpty: boolean
  fakePersonaFallback: boolean
  forceCinematic: boolean
  identityLock: boolean
  allowRestyle: boolean
}

const OFF: PromptTemplateFlags = {
  inventWorld: false,
  fillOnlyEmpty: false,
  injectStory: false,
  persistHardRulesFallback: false,
  speechLockIfEmpty: false,
  fakePersonaFallback: false,
  forceCinematic: false,
  identityLock: false,
  allowRestyle: false
}

export function isCopyTemplateId(id: string | null | undefined): id is CopyTemplateId {
  return COPY_TEMPLATE_IDS.includes(id as CopyTemplateId)
}

export function isMediaTemplateId(
  id: string | null | undefined
): id is MediaTemplateId {
  return MEDIA_TEMPLATE_IDS.includes(id as MediaTemplateId)
}

export function defaultTemplateId(family: PromptTemplateFamily): PromptTemplateId {
  return family === 'copy' ? 'polish-only' : 'follow-asset'
}

export function resolvePromptTemplate(
  raw: string | null | undefined,
  family: PromptTemplateFamily = 'copy'
): PromptTemplateId {
  if (family === 'copy' && isCopyTemplateId(raw)) return raw
  if (family === 'media' && isMediaTemplateId(raw)) return raw
  return defaultTemplateId(family)
}

export function flagsForTemplate(id: PromptTemplateId): PromptTemplateFlags {
  switch (id) {
    case 'polish-only':
      return { ...OFF }
    case 'fill-blanks':
      return { ...OFF, fillOnlyEmpty: true }
    case 'invent':
      return { ...OFF, inventWorld: true }
    case 'from-story':
      return { ...OFF, inventWorld: true, injectStory: true }
    case 'follow-asset':
      return { ...OFF }
    case 'cinematic-lock':
      return { ...OFF, forceCinematic: true, identityLock: true }
    case 'identity-lock':
      return { ...OFF, identityLock: true }
    case 'restyle':
      return { ...OFF, allowRestyle: true }
    default:
      return { ...OFF }
  }
}

const SYSTEM_KEYS: Record<PromptTemplateId, 'tpl.system.polishOnly' | 'tpl.system.fillBlanks' | 'tpl.system.invent' | 'tpl.system.fromStory' | 'tpl.system.followAsset' | 'tpl.system.cinematicLock' | 'tpl.system.identityLock' | 'tpl.system.restyle'> =
  {
    'polish-only': 'tpl.system.polishOnly',
    'fill-blanks': 'tpl.system.fillBlanks',
    invent: 'tpl.system.invent',
    'from-story': 'tpl.system.fromStory',
    'follow-asset': 'tpl.system.followAsset',
    'cinematic-lock': 'tpl.system.cinematicLock',
    'identity-lock': 'tpl.system.identityLock',
    restyle: 'tpl.system.restyle'
  }

/** Append the chosen recipe onto an existing system prompt. */
export function assembleSystemPrompt(opts: {
  base: string
  locale?: string | null
  templateId?: string | null
  family?: PromptTemplateFamily
}): string {
  const family = opts.family ?? 'copy'
  const id = resolvePromptTemplate(opts.templateId, family)
  const loc = opts.locale || 'zh-HK'
  const extra = PromptCatalog.t(loc, SYSTEM_KEYS[id])
  return [opts.base.trim(), extra].filter(Boolean).join('\n')
}

export function templatesForFamily(
  family: PromptTemplateFamily
): readonly PromptTemplateId[] {
  return family === 'copy' ? COPY_TEMPLATE_IDS : MEDIA_TEMPLATE_IDS
}

export function templateFlags(
  raw: string | null | undefined,
  family: PromptTemplateFamily = 'copy'
): PromptTemplateFlags {
  return flagsForTemplate(resolvePromptTemplate(raw, family))
}

/** Second-pass empty-key invent — only fill-blanks / invent / from-story. */
export function shouldFillMissingKeys(
  raw: string | null | undefined,
  family: PromptTemplateFamily = 'copy'
): boolean {
  const f = templateFlags(raw, family)
  return f.fillOnlyEmpty || f.inventWorld
}

export function shouldPersistHardRulesFallback(
  raw: string | null | undefined,
  family: PromptTemplateFamily = 'copy'
): boolean {
  return templateFlags(raw, family).persistHardRulesFallback
}

export function shouldForceCinematic(
  raw: string | null | undefined,
  family: PromptTemplateFamily = 'media'
): boolean {
  return templateFlags(raw, family).forceCinematic
}
