/**
 * Universal short-drama character creation prompt + JSON extract.
 * Output fills InstantDrama Character profile fields.
 */

import type { CharacterProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { AppError } from '../types/errors'
import {
  artStylePrompt,
  getArtStyle,
  qualityBlockForFamily,
  type ArtStyleId
} from './characterArtStyles'
import {
  buildSheetIdentityLock,
  getSheetVariant,
  sheetLayoutPrompt
} from './characterSheetVariants'
import { speechLanguageLockLine } from './speechLanguageLock'
import {
  coerceProfileString,
  coerceProfileStringFrom,
  extractJsonObject,
  profileCompletenessRules,
  synthesizeVisualTagsFromText,
  VISUAL_TAGS_KEYS
} from './jsonProfileFields'
import { PromptCatalog, resolvePromptContext } from '../prompts'
import { inventRulesForTemplate } from './storyContextPolicy'
import { assembleSystemPrompt } from './promptTemplates'
import { normalizeLanguageCodes } from './worldLanguages'
import { appendHardRules, normalizeHardRules } from './promptHardRules'

export const CHARACTER_PROFILE_JSON_KEYS = [
  'name',
  'description',
  'appearance',
  'personality',
  'backstory',
  'costume',
  'ageRange',
  'gender',
  'voiceDesc',
  'spokenLanguages',
  'mannerisms',
  'relationships',
  'visualTags',
  'hardRules'
] as const

export function buildCharacterMasterSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const ctx = resolvePromptContext(locale)
  const keys = CHARACTER_PROFILE_JSON_KEYS.join(', ')
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'character.system'),
      PromptCatalog.t(locale, 'character.keysLead', { keys }),
      PromptCatalog.t(locale, 'common.rules'),
      ...profileCompletenessRules(
        CHARACTER_PROFILE_JSON_KEYS.filter((k) => k !== 'spokenLanguages'),
        locale
      ).map((r) => `- ${r}`),
      ...inventRulesForTemplate(locale, templateId).map((r) => `- ${r}`),
      `- ${PromptCatalog.t(locale, 'character.ruleSpoken')}`,
      `- ${PromptCatalog.t(locale, 'character.ruleIdentity')}`,
      ctx.pack.hardRulesInstruction,
      ctx.outputLock
    ].join('\n')
  })
}

export function buildCharacterMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: string
  /** When set, model should refine/improve this draft rather than invent from scratch */
  existingDraft?: Partial<CharacterProfileFields> | null
  /**
   * Full soul.md / Soul Hub markdown linked on the character.
   * Used as high-priority identity bible when improving the profile.
   */
  soulContent?: string | null
}): string {
  const soul = options.soulContent?.trim() ?? ''
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea,
    draft: (options.existingDraft ?? undefined) as
      | Record<string, unknown>
      | undefined,
    draftLabelKey: 'character.draftLabel',
    extraBlocks: soul
      ? [{ labelKey: 'character.soulLabel', body: soul }]
      : [],
    storyTitle: options.storyTitle,
    styleNote: options.styleNote,
    createLabelKey: 'character.createLabel',
    emptyIdeaPolishKey: 'character.emptyPolish',
    closing: PromptCatalog.t(options.locale || 'zh-HK', 'character.closing', {
      keys: CHARACTER_PROFILE_JSON_KEYS.join(', ')
    })
  })
}

/** Extract first JSON object from model text (tolerates ```json fences). */
export function extractCharacterProfileJson(text: string): CharacterProfileFields {
  const parsed = extractJsonObject(text)
  const name = coerceProfileString(parsed.name)
  if (!name) throw new AppError('VALIDATION', 'errors.characterJsonMissingName')
  const spokenLanguages = normalizeLanguageCodes(
    parsed.spokenLanguages ?? parsed.languages ?? parsed.spoken_languages
  )
  const description = coerceProfileString(parsed.description) || name
  const appearance = coerceProfileString(parsed.appearance)
  const costume = coerceProfileString(parsed.costume)
  let visualTags = coerceProfileStringFrom(parsed, [...VISUAL_TAGS_KEYS])
  if (!visualTags) {
    visualTags = synthesizeVisualTagsFromText([
      name,
      description,
      appearance,
      costume
    ])
  }
  return {
    name,
    description,
    appearance,
    personality: coerceProfileString(parsed.personality),
    backstory: coerceProfileString(parsed.backstory),
    costume,
    ageRange: coerceProfileString(parsed.ageRange),
    gender: coerceProfileString(parsed.gender),
    voiceDesc: coerceProfileString(parsed.voiceDesc),
    spokenLanguages:
      spokenLanguages.length > 0 ? spokenLanguages : undefined,
    mannerisms: coerceProfileString(parsed.mannerisms),
    relationships: coerceProfileString(parsed.relationships),
    visualTags,
    hardRules: normalizeHardRules(coerceProfileString(parsed.hardRules)) || ''
  }
}

/**
 * Prompt for multi-angle reference sheet (image gen).
 * Style is front-loaded — models weight the start of the prompt heavily.
 */
export function buildCharacterSheetImagePrompt(
  profile: Partial<CharacterProfileFields> & { name: string },
  variant: string = 'bible',
  artStyle: string = 'photo_cinematic',
  locale: string = 'zh-HK'
): string {
  const def = getSheetVariant(variant)
  const style = getArtStyle(artStyle)
  const skipOuterCostume =
    def.wardrobeLayer === 'nude' || def.wardrobeLayer === 'base'
  const layerTag =
    def.wardrobeLayer === 'nude' ? 'body' : def.wardrobeLayer
  const medium = artStylePrompt(style.id, locale)
  const identity = buildSheetIdentityLock(
    {
      name: profile.name,
      ageRange: profile.ageRange,
      gender: profile.gender,
      appearance: profile.appearance,
      costume: profile.costume,
      visualTags: profile.visualTags,
      mannerisms: profile.mannerisms
    },
    qualityBlockForFamily(style.family, locale),
    { skipOuterCostume, locale }
  )
  const body = [
    medium,
    PromptCatalog.t(locale, 'sheet.scaffold.repeatMedium', {
      id: style.id,
      family: style.family
    }),
    identity,
    PromptCatalog.t(locale, 'sheet.scaffold.wardrobeTag', { tag: layerTag }),
    PromptCatalog.t(locale, 'sheet.scaffold.layoutLead', {
      layout: sheetLayoutPrompt(def.id, locale)
    }),
    PromptCatalog.t(locale, 'sheet.scaffold.finalCheck', { medium })
  ].join(' ')
  return appendHardRules(body, profile.hardRules)
}

/**
 * Decide generate vs edit for sheet packages.
 * Default: pure generate so layout/variant can change freely.
 * Edit only when the UI explicitly requests identity lock + a valid ref path exists.
 */
export function resolveSheetGenMode(opts: {
  useIdentityEdit?: boolean | null
  hasValidRef?: boolean
}): 'generate' | 'edit' {
  if (opts.useIdentityEdit === true && opts.hasValidRef) return 'edit'
  return 'generate'
}

/**
 * When re-generating with a prior gallery image as edit reference.
 * Critical: force NEW layout + medium — image_edit otherwise clones the source sheet.
 */
export function buildCharacterSheetEditPrompt(
  profile: Partial<CharacterProfileFields> & { name: string },
  variant: string = 'bible',
  artStyle: string = 'photo_cinematic',
  locale: string = 'zh-HK'
): string {
  const def = getSheetVariant(variant)
  const style = getArtStyle(artStyle)
  const skipOuterCostume =
    def.wardrobeLayer === 'nude' || def.wardrobeLayer === 'base'
  const layerTag =
    def.wardrobeLayer === 'nude' ? 'body' : def.wardrobeLayer
  const body = buildCharacterSheetImagePrompt(
    profile,
    variant,
    artStyle,
    locale
  )
  return [
    PromptCatalog.t(locale, 'sheet.edit.task'),
    artStylePrompt(style.id, locale),
    PromptCatalog.t(locale, 'sheet.edit.target', {
      id: def.id,
      tag: layerTag
    }),
    PromptCatalog.t(locale, 'sheet.edit.ignoreLayout'),
    PromptCatalog.t(locale, 'sheet.edit.ignoreWardrobe'),
    PromptCatalog.t(locale, 'sheet.edit.keepIdentity'),
    skipOuterCostume
      ? PromptCatalog.t(locale, 'sheet.edit.stripOuter')
      : PromptCatalog.t(locale, 'sheet.edit.applyProfileCostume'),
    PromptCatalog.t(locale, 'sheet.edit.changeMedium'),
    PromptCatalog.t(locale, 'sheet.edit.noNewPerson'),
    PromptCatalog.t(locale, 'sheet.edit.newComposition'),
    PromptCatalog.t(locale, 'sheet.edit.checklist', {
      id: def.id,
      tag: layerTag,
      style: style.id
    }),
    body
  ].join(' ')
}

export type { ArtStyleId }

/** Compact text block for video prompts (fallback + LLM polish input). */
export function characterVideoPromptBlock(
  c: Partial<CharacterProfileFields> & {
    name: string
    gender?: string
    artStyle?: string
  }
): string {
  const langs =
    Array.isArray(c.spokenLanguages) && c.spokenLanguages.length > 0
      ? c.spokenLanguages.join(', ')
      : null
  const speech = speechLanguageLockLine({
    name: c.name,
    codes: c.spokenLanguages,
    locale: 'zh-HK'
  })
  return [
    `Character: ${c.name}`,
    c.ageRange ? `Age: ${c.ageRange}` : null,
    c.gender ? `Gender: ${c.gender}` : null,
    c.appearance ? `Look: ${c.appearance}` : null,
    c.costume ? `Costume: ${c.costume}` : null,
    c.personality ? `Personality: ${c.personality}` : null,
    c.backstory ? `Backstory: ${c.backstory.slice(0, 280)}` : null,
    c.relationships ? `Relationships: ${c.relationships.slice(0, 200)}` : null,
    c.mannerisms ? `Mannerisms: ${c.mannerisms}` : null,
    c.voiceDesc ? `Voice: ${c.voiceDesc}` : null,
    c.visualTags ? `Visual tags: ${c.visualTags}` : null,
    c.artStyle ? `Art style: ${c.artStyle}` : null,
    langs ? `Spoken languages: ${langs}` : null,
    speech
  ]
    .filter(Boolean)
    .join('. ')
}

/**
 * Template fallback for self-intro video (LLM polish improves this).
 * Identity must match the reference image; dialogue/persona from full profile.
 */
export function buildCharacterIntroVideoPrompt(
  profile: Partial<CharacterProfileFields> & {
    name: string
    gender?: string
    artStyle?: string
  },
  locale: string = 'zh-HK',
  options?: { soulExcerpt?: string | null; skipDefaultCamera?: boolean }
): string {
  const identity = characterVideoPromptBlock(profile)
  const personality =
    profile.personality?.trim() ||
    profile.description?.trim() ||
    ''
  const manner = profile.mannerisms?.trim() || ''
  const voice = profile.voiceDesc?.trim() || ''
  const soul = (options?.soulExcerpt ?? '').trim().slice(0, 1200)
  const backstory = profile.backstory?.trim().slice(0, 240)
  const relationships = profile.relationships?.trim().slice(0, 160)

  return appendHardRules(
    [
      PromptCatalog.t(locale, 'charIntro.task'),
      PromptCatalog.t(locale, 'charIntro.identityLock'),
      identity,
      PromptCatalog.t(locale, 'charIntro.personality', { personality }),
      backstory
        ? PromptCatalog.t(locale, 'charIntro.backstory', { backstory })
        : null,
      relationships
        ? PromptCatalog.t(locale, 'charIntro.relationships', { relationships })
        : null,
      soul ? PromptCatalog.t(locale, 'charIntro.soul', { soul }) : null,
      manner
        ? PromptCatalog.t(locale, 'charIntro.manner', { manner })
        : null,
      options?.skipDefaultCamera
        ? null
        : PromptCatalog.t(locale, 'charIntro.cameraDefault'),
      PromptCatalog.t(locale, 'charIntro.speech', { voice }),
      speechLanguageLockLine({
        name: profile.name,
        codes: profile.spokenLanguages,
        locale
      }),
      PromptCatalog.t(locale, 'charIntro.beat'),
      PromptCatalog.t(locale, 'charIntro.lighting')
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}
