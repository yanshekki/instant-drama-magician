/**
 * AI fill / refine for scene location bible + script.
 */
import type { SceneProfileFields } from '../types/domain'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import { isArtStyleId, type ArtStyleId } from './characterArtStyles'
import { AppError } from '../types/errors'
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
import { appendHardRules, normalizeHardRules } from './promptHardRules'

export const SCENE_PROFILE_JSON_KEYS = [
  'title',
  'description',
  'script',
  'locationType',
  'timeOfDay',
  'weather',
  'mood',
  'lighting',
  'colorPalette',
  'setDressing',
  'soundscape',
  'cameraNotes',
  'visualTags',
  'artStyle',
  'hardRules'
] as const

export function buildSceneMasterSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const ctx = resolvePromptContext(locale)
  const keys = SCENE_PROFILE_JSON_KEYS.join(', ')
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'scene.system'),
      PromptCatalog.t(locale, 'scene.keysLead', { keys }),
      PromptCatalog.t(locale, 'common.rules'),
      ...profileCompletenessRules(SCENE_PROFILE_JSON_KEYS, locale).map(
        (r) => `- ${r}`
      ),
      ...inventRulesForTemplate(locale, templateId).map((r) => `- ${r}`),
      ctx.pack.hardRulesInstruction,
      ctx.outputLock
    ].join('\n')
  })
}

export function buildSceneMasterUserPrompt(options: {
  idea: string
  storyTitle?: string
  styleNote?: string | null
  locale?: string
  existingDraft?: Partial<SceneProfileFields> | null
  characterSnippets?: string[]
  propSnippets?: string[]
  priorSceneSnippets?: string[]
}): string {
  const extras: Array<{
    labelKey: 'scene.charsLabel' | 'scene.propsLabel' | 'scene.priorLabel'
    body: string
  }> = []
  if (options.characterSnippets?.length) {
    extras.push({
      labelKey: 'scene.charsLabel',
      body: options.characterSnippets.slice(0, 12).join('\n')
    })
  }
  if (options.propSnippets?.length) {
    extras.push({
      labelKey: 'scene.propsLabel',
      body: options.propSnippets.slice(0, 12).join('\n')
    })
  }
  if (options.priorSceneSnippets?.length) {
    extras.push({
      labelKey: 'scene.priorLabel',
      body: options.priorSceneSnippets.slice(0, 20).join('\n')
    })
  }
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea,
    draft: (options.existingDraft ?? undefined) as
      | Record<string, unknown>
      | undefined,
    draftLabelKey: 'scene.draftLabel',
    extraBlocks: extras,
    storyTitle: options.storyTitle,
    styleNote: options.styleNote,
    createLabelKey: 'scene.createLabel',
    emptyIdeaPolishKey: 'scene.emptyPolish',
    closing: PromptCatalog.t(options.locale || 'zh-HK', 'scene.closing', {
      keys: SCENE_PROFILE_JSON_KEYS.join(', ')
    })
  })
}

export function extractSceneProfileJson(text: string): SceneProfileFields & {
  artStyle?: ArtStyleId
} {
  const parsed = extractJsonObject(text)
  const description =
    coerceProfileString(parsed.description) ||
    coerceProfileString(parsed.title) ||
    ''
  if (!description) throw new AppError('VALIDATION', 'errors.sceneDescriptionRequired')
  const artRaw = coerceProfileString(parsed.artStyle)
  const title = coerceProfileString(parsed.title)
  let visualTags = coerceProfileStringFrom(parsed, [...VISUAL_TAGS_KEYS])
  if (!visualTags) {
    visualTags = synthesizeVisualTagsFromText([
      title,
      description,
      coerceProfileString(parsed.locationType),
      coerceProfileString(parsed.mood),
      coerceProfileString(parsed.lighting)
    ])
  }
  return {
    title,
    description,
    script: coerceProfileString(parsed.script),
    locationType: coerceProfileString(parsed.locationType),
    timeOfDay: coerceProfileString(parsed.timeOfDay),
    weather: coerceProfileString(parsed.weather),
    mood: coerceProfileString(parsed.mood),
    lighting: coerceProfileString(parsed.lighting),
    colorPalette: coerceProfileString(parsed.colorPalette),
    setDressing: coerceProfileString(parsed.setDressing),
    soundscape: coerceProfileString(parsed.soundscape),
    cameraNotes: coerceProfileString(parsed.cameraNotes),
    visualTags,
    hardRules: normalizeHardRules(coerceProfileString(parsed.hardRules)) || '',
    artStyle: artRaw && isArtStyleId(artRaw) ? artRaw : undefined
  }
}

export function buildSceneSuggestFromStoryUserPrompt(options: {
  storyTitle: string
  styleNote?: string | null
  locale?: string
  sceneNumber: number
  existingSceneTitles?: string[]
  characterSnippets: string[]
  propSnippets: string[]
  priorSceneSnippets: string[]
  /** Focused plot slice (all / scene / beat) */
  segmentLabel?: string | null
  /** Detailed text for the chosen segment */
  focusSnippets?: string[]
}): string {
  const loc = options.locale || 'zh-HK'
  const none = PromptCatalog.t(loc, 'common.none')
  return [
    PromptCatalog.t(loc, 'scene.suggestLead', {
      n: String(options.sceneNumber),
      title: options.storyTitle
    }),
    options.segmentLabel
      ? PromptCatalog.t(loc, 'scene.suggestPlotFocus', {
          label: options.segmentLabel
        })
      : '',
    options.styleNote
      ? PromptCatalog.t(loc, 'scene.suggestStyle', {
          style: options.styleNote
        })
      : '',
    options.existingSceneTitles?.length
      ? PromptCatalog.t(loc, 'scene.suggestExisting', {
          titles: options.existingSceneTitles.join('; ')
        })
      : '',
    PromptCatalog.t(loc, 'scene.suggestChars'),
    options.characterSnippets.join('\n') || none,
    PromptCatalog.t(loc, 'scene.suggestProps'),
    options.propSnippets.join('\n') || none,
    options.focusSnippets?.length
      ? PromptCatalog.t(loc, 'scene.suggestSegment')
      : PromptCatalog.t(loc, 'scene.suggestBeats'),
    (options.focusSnippets?.length
      ? options.focusSnippets
      : options.priorSceneSnippets
    ).join('\n---\n') || none,
    PromptCatalog.t(loc, 'scene.suggestClosing')
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Template fallback for location intro / establishing video (LLM polish improves this).
 * Space identity must match the reference plate; atmosphere from location bible.
 */
export function buildSceneIntroVideoPrompt(
  profile: Partial<SceneProfileFields> & {
    title?: string
    description: string
    artStyle?: string
  },
  locale: string = 'zh-HK'
): string {
  const name =
    profile.title?.trim() ||
    profile.description.trim().slice(0, 48) ||
    PromptCatalog.t(locale, 'scene.fallbackName')
  const place = profile.description.trim() || name
  const mood = profile.mood?.trim() || ''
  const lighting = profile.lighting?.trim() || ''
  const camera = profile.cameraNotes?.trim().slice(0, 200) || ''
  const time = profile.timeOfDay?.trim()
  const weather = profile.weather?.trim()
  const locationType = profile.locationType?.trim()
  const setDressing = profile.setDressing?.trim().slice(0, 200)
  const palette = profile.colorPalette?.trim()
  const soundscape = profile.soundscape?.trim().slice(0, 120)
  const tags = profile.visualTags?.trim()
  const art = profile.artStyle?.trim()
  const scriptCue = profile.script?.trim().slice(0, 200)

  return appendHardRules(
    [
      PromptCatalog.t(locale, 'sceneIntro.task'),
      PromptCatalog.t(locale, 'sceneIntro.spaceLock'),
      PromptCatalog.t(locale, 'sceneIntro.name', { name }),
      PromptCatalog.t(locale, 'sceneIntro.place', { place }),
      locationType
        ? PromptCatalog.t(locale, 'sceneIntro.spaceType', { type: locationType })
        : null,
      time ? PromptCatalog.t(locale, 'sceneIntro.time', { time }) : null,
      weather
        ? PromptCatalog.t(locale, 'sceneIntro.weather', { weather })
        : null,
      mood || lighting
        ? PromptCatalog.t(locale, 'sceneIntro.moodLight', { mood, lighting })
        : null,
      palette
        ? PromptCatalog.t(locale, 'sceneIntro.palette', { palette })
        : null,
      setDressing
        ? PromptCatalog.t(locale, 'sceneIntro.setDressing', { set: setDressing })
        : null,
      tags ? PromptCatalog.t(locale, 'sceneIntro.tags', { tags }) : null,
      art ? PromptCatalog.t(locale, 'sceneIntro.art', { art }) : null,
      soundscape
        ? PromptCatalog.t(locale, 'sceneIntro.ambient', { sound: soundscape })
        : null,
      scriptCue
        ? PromptCatalog.t(locale, 'sceneIntro.scriptCue', { cue: scriptCue })
        : null,
      camera
        ? PromptCatalog.t(locale, 'sceneIntro.camera', { camera })
        : null,
      PromptCatalog.t(locale, 'sceneIntro.beat')
    ]
      .filter(Boolean)
      .join(' '),
    profile.hardRules
  )
}
