import type { Character, Prop, Scene, TimelineEntry } from '../types/domain'

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
    scene ? `scene #${scene.sceneNumber}` : null,
    prop ? `prop ${prop.name}` : null,
    prev.dialogue ? `said “${prev.dialogue.slice(0, 80)}”` : null
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
  seconds: number
  previousContext?: string | null
}): string {
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
      ? `Scene #${options.scene.sceneNumber}: ${options.scene.description}`
      : null,
    options.scene?.script ? `Script: ${options.scene.script.slice(0, 400)}` : null,
    options.prop ? `Prop: ${options.prop.name}` : null,
    options.dialogue ? `Dialogue: ${options.dialogue}` : null,
    options.previousContext,
    `Duration: ${options.seconds}s. Cinematic, continuous action.`
  ]
    .filter(Boolean)
    .join('\n')
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
