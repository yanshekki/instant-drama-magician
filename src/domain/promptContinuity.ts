import type { Character, Prop, Scene, TimelineEntry } from '../types/domain'
import {
  beatContentToClipPromptBlock,
  extractSpokenLines,
  parseBeatContent
} from './beatContent'

/**
 * Pick a single still for video image-conditioning.
 * Priority: character sheet/cover → scene location plate → prop hero.
 */
export function resolveClipRefImage(options: {
  character?: Character | null
  scene?: Scene | null
  prop?: Prop | null
}): { path: string; source: 'character' | 'scene' | 'prop' } | null {
  const c =
    options.character?.refSheetPath || options.character?.refImagePath || null
  if (c) return { path: c, source: 'character' }
  const s = options.scene?.refImagePath || null
  if (s) return { path: s, source: 'scene' }
  const p = options.prop?.refImagePath || null
  if (p) return { path: p, source: 'prop' }
  return null
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
  const ordered = [...entries].sort((a, b) => a.order - b.order)
  const idx = ordered.findIndex((e) => e.id === currentId)
  if (idx <= 0) return null
  const prev = ordered[idx - 1]
  const char = prev.characterId ? maps.characters.get(prev.characterId) : undefined
  const scene = prev.sceneId ? maps.scenes.get(prev.sceneId) : undefined
  const prop = prev.propId ? maps.props.get(prev.propId) : undefined
  const bits = [
    char ? `character ${char.name}` : null,
    scene
      ? `scene #${scene.sceneNumber}${scene.title ? ` ${scene.title}` : ''}${scene.mood ? ` (${scene.mood})` : ''}`
      : null,
    prop ? `prop ${prop.name}` : null,
    (() => {
      const spoken = extractSpokenLines(
        parseBeatContent(
          prev.dialogue,
          (prev as { beatContentJson?: string | null }).beatContentJson
        )
      )
      const snip = (spoken || prev.dialogue || '').slice(0, 80)
      return snip ? `said “${snip}”` : null
    })()
  ].filter(Boolean)
  if (bits.length === 0) return null
  return `Continue visually from previous clip (${bits.join(', ')}).`
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
 */
export function appendRevisionToClipPrompt(
  basePrompt: string,
  revisionPrompt?: string | null
): string {
  const note = revisionPrompt?.trim()
  if (!note) return basePrompt
  return [
    basePrompt,
    '',
    'DIRECTOR REVISION (must follow; override conflicting earlier details):',
    note,
    'Anatomically correct humans unless the script requires otherwise: two hands, two arms, two legs; no extra limbs.'
  ].join('\n')
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
