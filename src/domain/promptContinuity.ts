import type { Action, Character, Prop, Scene, TimelineEntry } from '../types/domain'
import {
  beatContentToClipPromptBlock,
  extractSpokenLines,
  parseBeatContent
} from './beatContent'
import { ensureHardRules } from './promptHardRules'

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
}): string {
  const lines = [
    'CONTINUITY LOCK (must obey for short-drama sequence):',
    options.hasContinuityImage
      ? `The attached image is the END FRAME / KEYFRAME of beat #${options.previousBeatIndex}. This new shot continues from that exact visual state.`
      : `Continue from beat #${options.previousBeatIndex} (no still available — match dossier only).`,
    options.sameCharacter
      ? 'IDENTITY: same person — face, hair, body proportions, wardrobe colors, accessories. No restyle, no age shift.'
      : null,
    options.sameScene
      ? 'SPACE: same location — architecture, materials, layout, light direction. Only subtle time-of-day drift if the beat requires it.'
      : null,
    'ACTION: pick up motion/pose/gaze from the previous frame; do not hard-cut to a different setup.',
    options.previousDialogueSnippet
      ? `Previous beat context: ${options.previousDialogueSnippet.slice(0, 120)}`
      : null,
    'No text overlays, logos, watermarks.'
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
}): string {
  const beatBlock =
    beatContentToClipPromptBlock(
      parseBeatContent(options.dialogue, options.beatContentJson),
      options.dialogue
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
  hardRules?: string | null
): string {
  const note = revisionPrompt?.trim()
  let out = basePrompt
  if (note) {
    out = [
      basePrompt,
      '',
      'DIRECTOR REVISION (supplement only — must not violate HARD RULES):',
      note,
      'Anatomically correct humans unless the script requires otherwise: two hands, two arms, two legs; no extra limbs.'
    ].join('\n')
  }
  return ensureHardRules(out, hardRules)
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
