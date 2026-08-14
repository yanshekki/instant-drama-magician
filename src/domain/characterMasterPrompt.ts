/**
 * Universal short-drama character creation prompt + JSON extract.
 * Output fills InstantDrama Character profile fields.
 */

import type { CharacterProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { AppError } from '../types/errors'
import {
  getArtStyle,
  qualityBlockForFamily,
  type ArtStyleId
} from './characterArtStyles'
import {
  buildSheetIdentityLock,
  getSheetVariant
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
import { inventFromProvidedSourcesRules } from './storyContextPolicy'
import { normalizeLanguageCodes } from './worldLanguages'
import {
  appendHardRules,
  defaultHardRulesFallback,
  normalizeHardRules
} from './promptHardRules'

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

export function buildCharacterMasterSystemPrompt(locale: string = 'zh-HK'): string {
  const ctx = resolvePromptContext(locale)
  const keys = CHARACTER_PROFILE_JSON_KEYS.join(', ')
  return [
    PromptCatalog.t(locale, 'character.system'),
    PromptCatalog.t(locale, 'character.keysLead', { keys }),
    PromptCatalog.t(locale, 'common.rules'),
    ...profileCompletenessRules(
      CHARACTER_PROFILE_JSON_KEYS.filter((k) => k !== 'spokenLanguages'),
      locale
    ).map((r) => `- ${r}`),
    ...inventFromProvidedSourcesRules(locale).map((r) => `- ${r}`),
    `- ${PromptCatalog.t(locale, 'character.ruleSpoken')}`,
    `- ${PromptCatalog.t(locale, 'character.ruleIdentity')}`,
    ctx.pack.hardRulesInstruction,
    ctx.outputLock
  ].join('\n')
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
    hardRules:
      normalizeHardRules(coerceProfileString(parsed.hardRules)) ||
      defaultHardRulesFallback('character', 'zh-HK')
  }
}

/**
 * Prompt for multi-angle reference sheet (image gen).
 * Style is front-loaded — models weight the start of the prompt heavily.
 */
export function buildCharacterSheetImagePrompt(
  profile: Partial<CharacterProfileFields> & { name: string },
  variant: string = 'bible',
  artStyle: string = 'photo_cinematic'
): string {
  const def = getSheetVariant(variant)
  const style = getArtStyle(artStyle)
  const skipOuterCostume =
    def.wardrobeLayer === 'nude' || def.wardrobeLayer === 'base'
  // "nude" as a word trips Grok Imagine filters — prompt uses "body" for that layer
  const layerTag =
    def.wardrobeLayer === 'nude' ? 'body' : def.wardrobeLayer
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
    qualityBlockForFamily(style.family),
    { skipOuterCostume }
  )
  // Order: STYLE (×2) → identity → layout → style reminder → HARD RULES last
  const body = [
    style.promptBlock,
    `Repeat: the final image medium MUST be exactly style id "${style.id}" (${style.family}).`,
    identity,
    `Wardrobe layer tag: ${layerTag}.`,
    `LAYOUT: ${def.layout}`,
    `Final check: if the image looks like the wrong medium, regenerate in the correct medium: ${style.promptBlock}`
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
  artStyle: string = 'photo_cinematic'
): string {
  const def = getSheetVariant(variant)
  const style = getArtStyle(artStyle)
  const skipOuterCostume =
    def.wardrobeLayer === 'nude' || def.wardrobeLayer === 'base'
  const layerTag =
    def.wardrobeLayer === 'nude' ? 'body' : def.wardrobeLayer
  const body = buildCharacterSheetImagePrompt(profile, variant, artStyle)
  return [
    'IMAGE EDIT / LAYOUT CHANGE TASK (highest priority — read fully):',
    style.promptBlock,
    `Target sheet package id: "${def.id}". Wardrobe layer: ${layerTag}.`,
    'IGNORE the source image LAYOUT completely: panel count, gutters, camera angles, crop, and framing from the source must NOT be copied.',
    'IGNORE the source wardrobe/clothing if it conflicts with the target wardrobe layer below.',
    'KEEP only CHARACTER IDENTITY from the source: face/head design, hair, body proportions, species/body plan, skin or surface markings, age presentation.',
    skipOuterCostume
      ? 'STRIP all outer clothing/armor from the source. For body plates: skin-tone unitard only. For base layer: simple undergarments only. Do not preserve the source outfit.'
      : 'You may apply the PROFILE costume description in the body prompt; do not merely recolor or crop the source costume panels.',
    'Completely CHANGE the rendering medium if needed to match the mandatory art style.',
    'DO NOT invent a different character. DO NOT only crop, zoom, or recolor the source.',
    'Produce an entirely NEW reference-sheet composition that matches the LAYOUT block exactly (panel count and poses).',
    `Final checklist: (1) identity matches source face/body (2) layout matches package "${def.id}" not the source sheet (3) wardrobe layer ${layerTag} (4) medium = ${style.id}.`,
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
  options?: { soulExcerpt?: string | null }
): string {
  const identity = characterVideoPromptBlock(profile)
  const personality =
    profile.personality?.trim() ||
    profile.description?.trim() ||
    PromptCatalog.t(locale, 'character.fallbackPersonality')
  const manner =
    profile.mannerisms?.trim() ||
    PromptCatalog.t(locale, 'character.fallbackManner')
  const voice =
    profile.voiceDesc?.trim() ||
    PromptCatalog.t(locale, 'character.fallbackVoice')
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
      PromptCatalog.t(locale, 'charIntro.performance', { manner }),
      PromptCatalog.t(locale, 'charIntro.speech', { voice }),
      speechLanguageLockLine({
        name: profile.name,
        codes: profile.spokenLanguages,
        locale
      }),
      PromptCatalog.t(locale, 'charIntro.beat'),
      PromptCatalog.t(locale, 'charIntro.lighting'),
      PromptCatalog.t(locale, 'charIntro.duration')
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}
