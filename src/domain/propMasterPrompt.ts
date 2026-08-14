import type { PropProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { isArtStyleId, type ArtStyleId } from './characterArtStyles'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules,
  synthesizeVisualTagsFromText,
  VISUAL_TAGS_KEYS
} from './jsonProfileFields'
import { PromptCatalog, resolvePromptContext } from '../prompts'
import { inventFromProvidedSourcesRules } from './storyContextPolicy'
import {
  appendHardRules,
  defaultHardRulesFallback,
  normalizeHardRules
} from './promptHardRules'

export const PROP_PROFILE_JSON_KEYS = [
  'name',
  'description',
  'material',
  'sizeNotes',
  'condition',
  'visualTags',
  'artStyle',
  'hardRules'
] as const

export function buildPropMasterSystemPrompt(locale: string = 'zh-HK'): string {
  const ctx = resolvePromptContext(locale)
  const keys = PROP_PROFILE_JSON_KEYS.join(', ')
  return [
    PromptCatalog.t(locale, 'prop.system'),
    PromptCatalog.t(locale, 'prop.keysLead', { keys }),
    PromptCatalog.t(locale, 'common.rules'),
    ...profileCompletenessRules(PROP_PROFILE_JSON_KEYS, locale).map(
      (r) => `- ${r}`
    ),
    ...inventFromProvidedSourcesRules(locale).map((r) => `- ${r}`),
    ctx.pack.hardRulesInstruction,
    ctx.outputLock
  ].join('\n')
}

export function buildPropMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: string
  existingDraft?: Partial<PropProfileFields> | null
}): string {
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea,
    draft: (options.existingDraft ?? undefined) as
      | Record<string, unknown>
      | undefined,
    draftLabelKey: 'prop.draftLabel',
    storyTitle: options.storyTitle,
    styleNote: options.styleNote,
    createLabelKey: 'prop.createLabel',
    emptyIdeaPolishKey: 'prop.emptyPolish',
    closing: PromptCatalog.t(options.locale || 'zh-HK', 'prop.closing', {
      keys: PROP_PROFILE_JSON_KEYS.join(', ')
    })
  })
}

/**
 * Template fallback for prop intro video (LLM polish improves this).
 * Object identity must match the reference still.
 */
export function buildPropIntroVideoPrompt(
  profile: Partial<PropProfileFields> & {
    name: string
    description: string
    artStyle?: string
  },
  locale: string = 'zh-HK'
): string {
  const name =
    profile.name.trim() || PromptCatalog.t(locale, 'prop.fallbackName')
  const look = profile.description.trim() || name
  const material = profile.material?.trim()
  const size = profile.sizeNotes?.trim()
  const condition = profile.condition?.trim()
  const tags = profile.visualTags?.trim()
  const art = profile.artStyle?.trim()

  return appendHardRules(
    [
      PromptCatalog.t(locale, 'propIntro.task'),
      PromptCatalog.t(locale, 'propIntro.objectLock'),
      PromptCatalog.t(locale, 'propIntro.name', { name }),
      PromptCatalog.t(locale, 'propIntro.look', { look }),
      material
        ? PromptCatalog.t(locale, 'propIntro.material', { material })
        : null,
      size ? PromptCatalog.t(locale, 'propIntro.size', { size }) : null,
      condition
        ? PromptCatalog.t(locale, 'propIntro.condition', { condition })
        : null,
      tags ? PromptCatalog.t(locale, 'propIntro.tags', { tags }) : null,
      art ? PromptCatalog.t(locale, 'propIntro.art', { art }) : null,
      PromptCatalog.t(locale, 'propIntro.camera'),
      PromptCatalog.t(locale, 'propIntro.beat'),
      PromptCatalog.t(locale, 'propIntro.noHands'),
      PromptCatalog.t(locale, 'propIntro.duration')
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}

export function extractPropProfileJson(
  text: string
): PropProfileFields & { artStyle?: ArtStyleId } {
  const parsed = extractJsonObject(text)
  const name = coerceProfileString(parsed.name) || 'Prop'
  const description = coerceProfileString(parsed.description) || name
  const material = coerceProfileString(parsed.material)
  const sizeNotes = coerceProfileString(parsed.sizeNotes)
  const condition = coerceProfileString(parsed.condition)
  let visualTags = coerceProfileStringFrom(parsed, [...VISUAL_TAGS_KEYS])
  if (!visualTags) {
    visualTags = synthesizeVisualTagsFromText([
      name,
      description,
      material,
      condition
    ])
  }
  const artRaw = coerceProfileString(parsed.artStyle)
  return {
    name,
    description,
    material,
    sizeNotes,
    condition,
    visualTags,
    artStyle: artRaw && isArtStyleId(artRaw) ? artRaw : undefined,
    hardRules:
      normalizeHardRules(coerceProfileString(parsed.hardRules)) ||
      defaultHardRulesFallback('prop', 'zh-HK')
  }
}
