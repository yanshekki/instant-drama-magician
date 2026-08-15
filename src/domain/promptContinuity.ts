import type { Action, Character, Prop, Scene, TimelineEntry } from '../types/domain'
import { PromptCatalog } from '../prompts'
import {
  beatContentToClipPromptBlock,
  extractSpokenLines,
  parseBeatContent
} from './beatContent'
import { ensureHardRules } from './promptHardRules'
import {
  parseSpokenLanguageInput,
  speechLanguageLockLine
} from './speechLanguageLock'

export type ClipRefSource =
  | 'prev-clip'
  | 'cast'
  | 'character'
  | 'scene'
  | 'prop'
  | 'action'

/**
 * Pick a single still for video image-conditioning.
 * Priority: previous continuity → advanced cast look → character → scene → prop → action plate.
 */
export function resolveClipRefImage(options: {
  character?: Character | null
  scene?: Scene | null
  prop?: Prop | null
  action?: Pick<Action, 'refImagePath'> | null
  /** Path to previous beat's continuity keyframe (if file exists). */
  previousContinuityPath?: string | null
  /** When false, skip previous-clip lock (library assets only). Default true. */
  usePreviousContinuity?: boolean
  /**
   * Advanced prep cast/costume image for primary character.
   * Used when no previous continuity, or when preferCastOverContinuity.
   */
  castRefPath?: string | null
  /** Prefer cast look over previous continuity (rare; default false). */
  preferCastOverContinuity?: boolean
}): { path: string; source: ClipRefSource } | null {
  const usePrev = options.usePreviousContinuity !== false
  const prev = options.previousContinuityPath?.trim() || null
  const cast = options.castRefPath?.trim() || null
  if (options.preferCastOverContinuity && cast) {
    return { path: cast, source: 'cast' }
  }
  if (usePrev && prev) {
    return { path: prev, source: 'prev-clip' }
  }
  if (cast) {
    return { path: cast, source: 'cast' }
  }
  const c =
    options.character?.refSheetPath || options.character?.refImagePath || null
  if (c) return { path: c, source: 'character' }
  const s = options.scene?.refImagePath || null
  if (s) return { path: s, source: 'scene' }
  const p = options.prop?.refImagePath || null
  if (p) return { path: p, source: 'prop' }
  const a = options.action?.refImagePath || null
  if (a) return { path: a, source: 'action' }
  return null
}

/**
 * Timeline still / clip refs: always prefer previous continuity as edit base,
 * and collect multi paths for vision polish (prev + cast + library).
 */
export function resolveTimelineStillRefs(options: {
  character?: Character | null
  scene?: Scene | null
  prop?: Prop | null
  action?: Pick<Action, 'refImagePath'> | null
  previousContinuityPath?: string | null
  castRefPath?: string | null
  /**
   * Explicit payload source (user pick). Used only if prev missing, or
   * merged into polish list — never overrides prev for timeline edit base.
   */
  payloadSourcePath?: string | null
  /** Max polish images (default 6). */
  maxPolishPaths?: number
  /** pathExists; default always true (caller filters). */
  pathExists?: (path: string) => boolean
}): {
  editBase: string | null
  editSource: ClipRefSource | 'payload' | null
  polishPaths: string[]
} {
  const exists = options.pathExists ?? (() => true)
  const pick = (p: string | null | undefined): string | null => {
    const t = p?.trim() || null
    return t && exists(t) ? t : null
  }
  const prev = pick(options.previousContinuityPath)
  const cast = pick(options.castRefPath)
  const payload = pick(options.payloadSourcePath)
  const char =
    pick(options.character?.refSheetPath) ||
    pick(options.character?.refImagePath)
  const scene = pick(options.scene?.refImagePath)
  const prop = pick(options.prop?.refImagePath)
  const action = pick(options.action?.refImagePath)

  // Timeline rule: prev continuity always wins as edit base when present.
  let editBase: string | null = null
  let editSource: ClipRefSource | 'payload' | null = null
  if (prev) {
    editBase = prev
    editSource = 'prev-clip'
  } else if (cast) {
    editBase = cast
    editSource = 'cast'
  } else if (payload) {
    editBase = payload
    editSource = 'payload'
  } else if (char) {
    editBase = char
    editSource = 'character'
  } else if (scene) {
    editBase = scene
    editSource = 'scene'
  } else if (prop) {
    editBase = prop
    editSource = 'prop'
  } else if (action) {
    editBase = action
    editSource = 'action'
  }

  const max = Math.max(1, options.maxPolishPaths ?? 6)
  const polishOrdered = [prev, cast, payload, char, scene, prop, action, editBase]
  const polishPaths: string[] = []
  const seen = new Set<string>()
  for (const p of polishOrdered) {
    if (!p || seen.has(p)) continue
    seen.add(p)
    polishPaths.push(p)
    if (polishPaths.length >= max) break
  }
  return { editBase, editSource, polishPaths }
}

/** Ordered previous entry (by order), or null if first clip. */
export function getPreviousTimelineEntry(
  entries: TimelineEntry[],
  currentId: string
): TimelineEntry | null {
  const ordered = [...entries].sort((a, b) => a.order - b.order)
  const idx = ordered.findIndex((e) => e.id === currentId)
  if (idx <= 0) return null
  return ordered[idx - 1] ?? null
}

/** 1-based beat index for UI labels. */
export function timelineBeatDisplayIndex(
  entries: TimelineEntry[],
  entryId: string
): number {
  const ordered = [...entries].sort((a, b) => a.order - b.order)
  const idx = ordered.findIndex((e) => e.id === entryId)
  return idx >= 0 ? idx + 1 : 0
}

/**
 * CONTINUITY LOCK block for polish / still prompts when previous frame is used.
 */
export function buildContinuityLockPrompt(options: {
  previousBeatIndex: number
  previousDialogueSnippet?: string | null
  sameCharacter?: boolean
  sameScene?: boolean
  hasContinuityImage: boolean
  locale?: string | null
}): string {
  const loc = options.locale || 'zh-HK'
  const n = options.previousBeatIndex
  const lines = [
    PromptCatalog.t(loc, 'continuity.lockHeader'),
    options.hasContinuityImage
      ? PromptCatalog.t(loc, 'continuity.hasImage', { n })
      : PromptCatalog.t(loc, 'continuity.noImage', { n }),
    options.sameCharacter
      ? PromptCatalog.t(loc, 'continuity.identity')
      : null,
    options.sameScene ? PromptCatalog.t(loc, 'continuity.space') : null,
    PromptCatalog.t(loc, 'continuity.action'),
    options.previousDialogueSnippet
      ? PromptCatalog.t(loc, 'continuity.prevContext', {
          snippet: options.previousDialogueSnippet.slice(0, 120)
        })
      : null,
    PromptCatalog.t(loc, 'continuity.noText')
  ]
  return lines.filter(Boolean).join('\n')
}

/** Previous-clip summary for visual continuity in video prompts. */
export function previousClipContext(
  entries: TimelineEntry[],
  currentId: string,
  maps: {
    characters: Map<string, Character>
    scenes: Map<string, Scene>
    props: Map<string, Prop>
  }
): string | null {
  const prev = getPreviousTimelineEntry(entries, currentId)
  if (!prev) return null
  const ordered = [...entries].sort((a, b) => a.order - b.order)
  const prevIndex = ordered.findIndex((e) => e.id === prev.id) + 1
  const char = prev.characterId
    ? maps.characters.get(prev.characterId)
    : undefined
  const scene = prev.sceneId ? maps.scenes.get(prev.sceneId) : undefined
  const prop = prev.propId ? maps.props.get(prev.propId) : undefined
  const spoken = extractSpokenLines(
    parseBeatContent(
      prev.dialogue,
      (prev as { beatContentJson?: string | null }).beatContentJson
    )
  )
  const snip = (spoken || prev.dialogue || '').slice(0, 100)
  const bits = [
    `beat #${prevIndex}`,
    char ? `character ${char.name}` : null,
    scene
      ? `scene #${scene.sceneNumber}${scene.title ? ` ${scene.title}` : ''}${scene.mood ? ` (${scene.mood})` : ''}`
      : null,
    prop ? `prop ${prop.name}` : null,
    snip ? `last line “${snip}”` : null
  ].filter(Boolean)
  return [
    `Continue visually from previous clip (${bits.join(', ')}).`,
    'Match wardrobe, hair, face identity, location geometry, and lighting continuity from the prior keyframe when provided.'
  ].join(' ')
}

export function buildClipPrompt(options: {
  storyTitle: string
  styleNote?: string | null
  character?: Character | null
  scene?: Scene | null
  prop?: Prop | null
  dialogue?: string | null
  beatContentJson?: string | null
  seconds: number
  previousContext?: string | null
  locale?: string | null
  speechLock?: string | null
}): string {
  const beatBlock =
    beatContentToClipPromptBlock(
      parseBeatContent(options.dialogue, options.beatContentJson),
      options.dialogue,
      options.locale
    ) ||
    (options.dialogue ? `Dialogue: ${options.dialogue}` : null)
  return [
    `Short drama clip for story "${options.storyTitle}".`,
    options.styleNote?.trim()
      ? `Style bible: ${options.styleNote.trim().slice(0, 400)}`
      : null,
    options.character
      ? `Character: ${options.character.name} — ${options.character.description}`
      : null,
    options.character?.refImagePath
      ? `Use character reference image for visual consistency (${options.character.name}).`
      : null,
    options.scene
      ? [
          `Scene #${options.scene.sceneNumber}${options.scene.title ? ` “${options.scene.title}”` : ''}: ${options.scene.description}`,
          options.scene.locationType
            ? `Location type: ${options.scene.locationType}`
            : null,
          options.scene.mood ? `Mood: ${options.scene.mood}` : null,
          options.scene.lighting ? `Lighting: ${options.scene.lighting}` : null,
          options.scene.weather || options.scene.timeOfDay
            ? `Time/weather: ${[options.scene.timeOfDay, options.scene.weather].filter(Boolean).join(' / ')}`
            : null,
          options.scene.setDressing
            ? `Set dressing: ${options.scene.setDressing.slice(0, 200)}`
            : null,
          options.scene.refImagePath
            ? `Use scene location reference image for continuity (${options.scene.refImagePath}).`
            : null
        ]
          .filter(Boolean)
          .join(' ')
      : null,
    options.scene?.script ? `Script: ${options.scene.script.slice(0, 400)}` : null,
    options.scene?.cameraNotes
      ? `Camera: ${options.scene.cameraNotes.slice(0, 200)}`
      : null,
    options.prop
      ? [
          `Prop: ${options.prop.name} — ${options.prop.description}`,
          options.prop.material ? `Material: ${options.prop.material}` : null,
          options.prop.refImagePath
            ? `Use prop reference image for continuity (${options.prop.name}).`
            : null
        ]
          .filter(Boolean)
          .join(' ')
      : null,
    beatBlock,
    options.previousContext,
    options.speechLock?.trim() ||
      speechLanguageLockLine({
        name: options.character?.name,
        codes: parseSpokenLanguageInput(options.character?.spokenLanguages),
        locale: options.locale || 'zh-HK'
      }),
    `Duration: ${options.seconds}s. Cinematic, continuous action.`
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Append optional director revision notes for re-generate / fix-pass prompts.
 * Not video-to-video; text constraints only (e.g. "only two hands").
 * Pass hardRules so they stay highest priority after revision.
 */
export function appendRevisionToClipPrompt(
  basePrompt: string,
  revisionPrompt?: string | null,
  hardRules?: string | null,
  locale?: string | null
): string {
  const note = revisionPrompt?.trim()
  const loc = locale || 'zh-HK'
  let out = basePrompt
  if (note) {
    out = [basePrompt, '', PromptCatalog.t(loc, 'clip.revision'), note].join(
      '\n'
    )
  }
  return ensureHardRules(out, hardRules, loc)
}

/** Characters used on timeline that lack a reference image. */
export function charactersMissingRef(
  entries: TimelineEntry[],
  characters: Character[]
): Character[] {
  const used = new Set(
    entries.map((e) => e.characterId).filter((id): id is string => Boolean(id))
  )
  return characters.filter((c) => used.has(c.id) && !c.refImagePath)
}
