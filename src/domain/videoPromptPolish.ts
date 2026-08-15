import { PromptCatalog, resolvePromptContext } from '../prompts'
import { speechLanguageLockLine } from './speechLanguageLock'
import {
  assembleSystemPrompt,
  shouldForceCinematic
} from './promptTemplates'

/**
 * LLM polish step before any generateVideo call.
 * Raw materials → chat → single director-style image-to-video prompt.
 * Chinese instruction text: Hong Kong written Chinese (書面語).
 */

export type VideoPromptKind = 'intro' | 'timeline_clip'

const SOUL_MAX_CHARS = 8000

export function truncateForVideoPrompt(
  text: string | null | undefined,
  max = SOUL_MAX_CHARS
): string {
  const t = (text ?? '').trim()
  if (!t) return ''
  if (t.length <= max) return t
  return `${t.slice(0, max)}\n…[truncated]`
}

/**
 * Materials block so polish LLM keeps HARD RULES and ends output with them.
 * Used by intro + timeline clip polish user prompts.
 */
export function hardRulesMaterialsBlock(
  hardRules: string | null | undefined,
  locale: string = 'zh-HK'
): string | null {
  const rules = (hardRules ?? '').trim()
  if (!rules) return null
  return [PromptCatalog.t(locale, 'videoPolish.hardRulesKeep'), rules].join('\n')
}

/**
 * System prompt for the video-prompt editor LLM.
 * Prompt body follows the user UI language (see output lock).
 */
export function buildVideoPromptPolishSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const { outputLock } = resolvePromptContext(locale)
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'media',
    base: [PromptCatalog.t(locale, 'videoPolish.system'), outputLock].join('\n')
  })
}

export interface IntroVideoPolishContext {
  locale?: string
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  /** Pre-built template fallback (already includes expanded profile). */
  fallbackPrompt: string
  name: string
  description?: string | null
  appearance?: string | null
  personality?: string | null
  backstory?: string | null
  costume?: string | null
  ageRange?: string | null
  gender?: string | null
  voiceDesc?: string | null
  mannerisms?: string | null
  relationships?: string | null
  visualTags?: string | null
  artStyle?: string | null
  seedPrompt?: string | null
  spokenLanguages?: string[] | null
  soulExcerpt?: string | null
  hardRules?: string | null
}

export function buildIntroVideoPolishUserPrompt(
  ctx: IntroVideoPolishContext
): string {
  const loc = ctx.locale || 'zh-HK'
  const langs =
    Array.isArray(ctx.spokenLanguages) && ctx.spokenLanguages.length > 0
      ? ctx.spokenLanguages.join(', ')
      : PromptCatalog.t(loc, 'intro.matchBible')
  const soul = truncateForVideoPrompt(ctx.soulExcerpt, SOUL_MAX_CHARS)
  return [
    PromptCatalog.t(loc, 'intro.task'),
    ctx.hasRefImage
      ? PromptCatalog.t(loc, 'intro.hasRef')
      : PromptCatalog.t(loc, 'intro.noRef'),
    PromptCatalog.t(loc, 'common.durationAspect', {
      seconds: ctx.seconds,
      aspect: ctx.aspectRatio || '16:9'
    }),
    PromptCatalog.t(loc, 'intro.dossier'),
    `name: ${ctx.name}`,
    ctx.ageRange ? `ageRange: ${ctx.ageRange}` : null,
    ctx.gender ? `gender: ${ctx.gender}` : null,
    ctx.description ? `description: ${ctx.description}` : null,
    ctx.appearance ? `appearance: ${ctx.appearance}` : null,
    ctx.costume ? `costume: ${ctx.costume}` : null,
    ctx.personality ? `personality: ${ctx.personality}` : null,
    ctx.backstory ? `backstory: ${ctx.backstory}` : null,
    ctx.voiceDesc ? `voiceDesc: ${ctx.voiceDesc}` : null,
    ctx.mannerisms ? `mannerisms: ${ctx.mannerisms}` : null,
    ctx.relationships ? `relationships: ${ctx.relationships}` : null,
    ctx.visualTags ? `visualTags: ${ctx.visualTags}` : null,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    ctx.seedPrompt ? `seedPrompt: ${ctx.seedPrompt}` : null,
    `spokenLanguages: ${langs}`,
    speechLanguageLockLine({
      name: ctx.name,
      codes: ctx.spokenLanguages,
      locale: ctx.locale || 'zh-HK'
    }),
    soul ? PromptCatalog.t(loc, 'intro.soul', { soul }) : null,
    hardRulesMaterialsBlock(ctx.hardRules, loc),
    PromptCatalog.t(loc, 'intro.templateDraft'),
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface SceneIntroVideoPolishContext {
  locale?: string
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  title?: string | null
  description: string
  script?: string | null
  locationType?: string | null
  timeOfDay?: string | null
  weather?: string | null
  mood?: string | null
  lighting?: string | null
  colorPalette?: string | null
  setDressing?: string | null
  soundscape?: string | null
  cameraNotes?: string | null
  visualTags?: string | null
  artStyle?: string | null
  seedPrompt?: string | null
  hardRules?: string | null
  promptTemplateId?: string | null
}

/** Materials for location / establishing intro clip polish. */
export function buildSceneIntroVideoPolishUserPrompt(
  ctx: SceneIntroVideoPolishContext
): string {
  const loc = ctx.locale || 'zh-HK'
  const name =
    ctx.title?.trim() ||
    ctx.description.trim().slice(0, 48) ||
    PromptCatalog.t(loc, 'scene.fallbackName')
  return [
    PromptCatalog.t(loc, 'sceneIntroPolish.task'),
    ctx.hasRefImage
      ? PromptCatalog.t(loc, 'sceneIntroPolish.hasRef')
      : PromptCatalog.t(loc, 'sceneIntroPolish.noRef'),
    PromptCatalog.t(loc, 'common.durationAspect', {
      seconds: ctx.seconds,
      aspect: ctx.aspectRatio || '16:9'
    }),
    PromptCatalog.t(loc, 'sceneIntroPolish.dossier'),
    `title: ${name}`,
    `description: ${ctx.description}`,
    ctx.locationType ? `locationType: ${ctx.locationType}` : null,
    ctx.timeOfDay ? `timeOfDay: ${ctx.timeOfDay}` : null,
    ctx.weather ? `weather: ${ctx.weather}` : null,
    ctx.mood ? `mood: ${ctx.mood}` : null,
    ctx.lighting ? `lighting: ${ctx.lighting}` : null,
    ctx.colorPalette ? `colorPalette: ${ctx.colorPalette}` : null,
    ctx.setDressing ? `setDressing: ${ctx.setDressing}` : null,
    ctx.soundscape ? `soundscape: ${ctx.soundscape}` : null,
    ctx.cameraNotes ? `cameraNotes: ${ctx.cameraNotes}` : null,
    ctx.visualTags ? `visualTags: ${ctx.visualTags}` : null,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    ctx.seedPrompt ? `seedPrompt: ${ctx.seedPrompt}` : null,
    ctx.script
      ? PromptCatalog.t(loc, 'sceneIntroPolish.scriptCue', {
          script: truncateForVideoPrompt(ctx.script, 1200)
        })
      : null,
    shouldForceCinematic(ctx.promptTemplateId)
      ? PromptCatalog.t(loc, 'sceneIntroPolish.emptySet')
      : null,
    hardRulesMaterialsBlock(ctx.hardRules, loc),
    PromptCatalog.t(loc, 'intro.templateDraft'),
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface PropIntroVideoPolishContext {
  locale?: string
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  name: string
  description: string
  material?: string | null
  sizeNotes?: string | null
  condition?: string | null
  visualTags?: string | null
  artStyle?: string | null
  seedPrompt?: string | null
  hardRules?: string | null
}

/** Materials for prop / object hero intro clip polish. */
export function buildPropIntroVideoPolishUserPrompt(
  ctx: PropIntroVideoPolishContext
): string {
  const loc = ctx.locale || 'zh-HK'
  return [
    PromptCatalog.t(loc, 'propIntroPolish.task'),
    ctx.hasRefImage
      ? PromptCatalog.t(loc, 'propIntroPolish.hasRef')
      : PromptCatalog.t(loc, 'propIntroPolish.noRef'),
    PromptCatalog.t(loc, 'common.durationAspect', {
      seconds: ctx.seconds,
      aspect: ctx.aspectRatio || '16:9'
    }),
    PromptCatalog.t(loc, 'propIntroPolish.dossier'),
    `name: ${ctx.name}`,
    `description: ${ctx.description}`,
    ctx.material ? `material: ${ctx.material}` : null,
    ctx.sizeNotes ? `sizeNotes: ${ctx.sizeNotes}` : null,
    ctx.condition ? `condition: ${ctx.condition}` : null,
    ctx.visualTags ? `visualTags: ${ctx.visualTags}` : null,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    ctx.seedPrompt ? `seedPrompt: ${ctx.seedPrompt}` : null,
    PromptCatalog.t(loc, 'propIntroPolish.noHands'),
    hardRulesMaterialsBlock(ctx.hardRules, loc),
    PromptCatalog.t(loc, 'intro.templateDraft'),
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface CostumeIntroVideoPolishContext {
  locale?: string
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  name: string
  description: string
  artStyle?: string | null
  hardRules?: string | null
}

/** Materials for wardrobe / costume look intro clip polish. */
export function buildCostumeIntroVideoPolishUserPrompt(
  ctx: CostumeIntroVideoPolishContext
): string {
  const loc = ctx.locale || 'zh-HK'
  return [
    PromptCatalog.t(loc, 'costumeIntroPolish.task'),
    ctx.hasRefImage
      ? PromptCatalog.t(loc, 'costumeIntroPolish.hasRef')
      : PromptCatalog.t(loc, 'costumeIntroPolish.noRef'),
    PromptCatalog.t(loc, 'common.durationAspect', {
      seconds: ctx.seconds,
      aspect: ctx.aspectRatio || '16:9'
    }),
    PromptCatalog.t(loc, 'costumeIntroPolish.dossier'),
    `name: ${ctx.name}`,
    `description: ${ctx.description}`,
    ctx.artStyle ? `artStyle: ${ctx.artStyle}` : null,
    PromptCatalog.t(loc, 'costumeIntroPolish.fabric'),
    hardRulesMaterialsBlock(ctx.hardRules, loc),
    PromptCatalog.t(loc, 'intro.templateDraft'),
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

export interface ClipVideoPolishContext {
  locale?: string
  seconds: number
  aspectRatio?: string
  hasRefImage: boolean
  fallbackPrompt: string
  storyTitle: string
  styleNote?: string | null
  characterBlocks?: string[]
  sceneBlock?: string | null
  propBlock?: string | null
  /** Motion-library action guide(s) for performance / blocking */
  actionBlock?: string | null
  beatOrDialogue?: string | null
  previousContext?: string | null
  multiCastNote?: string | null
  revisionPrompt?: string | null
  /**
   * Merged HARD RULES from story + bound cast (already labeled per object).
   * Must appear in materials so polish keeps them; final generate re-appends too.
   */
  hardRules?: string | null
  /** Prebuilt SPEECH LOCK; locale fallback is added when omitted. */
  speechLock?: string | null
}

export function buildClipVideoPolishUserPrompt(
  ctx: ClipVideoPolishContext
): string {
  const loc = ctx.locale || 'zh-HK'
  const rules = (ctx.hardRules ?? '').trim()
  return [
    PromptCatalog.t(loc, 'clip.task'),
    ctx.hasRefImage ? PromptCatalog.t(loc, 'clip.hasRef') : null,
    loc.toLowerCase().startsWith('zh')
      ? `故事：${ctx.storyTitle}`
      : `Story: ${ctx.storyTitle}`,
    ctx.styleNote?.trim()
      ? loc.toLowerCase().startsWith('zh')
        ? `風格：${ctx.styleNote.trim().slice(0, 600)}`
        : `Style bible: ${ctx.styleNote.trim().slice(0, 600)}`
      : null,
    PromptCatalog.t(loc, 'common.durationAspect', {
      seconds: ctx.seconds,
      aspect: ctx.aspectRatio || '16:9'
    }),
    ctx.multiCastNote || null,
    ctx.characterBlocks?.length
      ? `${PromptCatalog.t(loc, 'clip.characters')}\n${ctx.characterBlocks.join('\n---\n')}`
      : null,
    ctx.sceneBlock
      ? `${PromptCatalog.t(loc, 'clip.scene')}\n${ctx.sceneBlock}`
      : null,
    ctx.propBlock
      ? `${PromptCatalog.t(loc, 'clip.prop')}\n${ctx.propBlock}`
      : null,
    ctx.actionBlock
      ? `${PromptCatalog.t(loc, 'clip.action')}\n${ctx.actionBlock}`
      : null,
    ctx.beatOrDialogue
      ? `${PromptCatalog.t(loc, 'clip.beat')}\n${ctx.beatOrDialogue}`
      : null,
    ctx.speechLock?.trim() ||
      speechLanguageLockLine({
        locale: loc,
        uiLocale: loc
      }),
    ctx.previousContext
      ? `${PromptCatalog.t(loc, 'clip.prev')}\n${ctx.previousContext}`
      : null,
    ctx.revisionPrompt?.trim()
      ? `${PromptCatalog.t(loc, 'clip.revision')}\n${ctx.revisionPrompt.trim()}`
      : null,
    hardRulesMaterialsBlock(rules, loc),
    PromptCatalog.t(loc, 'clip.templateDraft'),
    ctx.fallbackPrompt
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Pull the polished prompt from an LLM reply (strip fences / labels).
 */
export function extractPolishedVideoPrompt(raw: string): string {
  let t = (raw ?? '').trim()
  if (!t) return ''
  // ```...``` or ```text
  const fence = t.match(/```(?:[\w-]+)?\s*([\s\S]*?)```/)
  if (fence?.[1]) t = fence[1].trim()
  // Common prefixes
  t = t.replace(/^(?:final\s+)?(?:video\s+)?prompt\s*[:：]\s*/i, '').trim()
  t = t.replace(/^提示詞\s*[:：]\s*/i, '').trim()
  // Drop surrounding quotes
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim()
  }
  return t
}
