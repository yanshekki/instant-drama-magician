import { PromptCatalog } from '../prompts'
import {
  beatSegmentLabel,
  locationSnippet,
  sceneLinkLabel,
  unknownCharacterName,
  whereFromScene
} from './residualLabels'

/** Clamp merged plot snippets so suggest-from-story stays under chat timeouts. */
export const PLOT_FOCUS_MAX_CHARS = 4000

export const PLOT_FOCUS_STORY_INCLUDE = {
  chapters: { orderBy: { order: 'asc' as const }, take: 24 },
  storyScenes: {
    orderBy: { sceneNumber: 'asc' as const },
    take: 40,
    include: { scene: true }
  },
  timeline: {
    orderBy: { order: 'asc' as const },
    take: 80,
    include: {
      character: true,
      scene: true,
      prop: true
    }
  }
}

export type PlotFocusChapter = {
  id?: string
  order: number
  title?: string | null
  body?: string | null
}

export type PlotFocusSceneLink = {
  sceneId: string
  sceneNumber: number
  scriptOverride?: string | null
  scene: {
    title?: string | null
    description: string
    script?: string | null
    mood?: string | null
    timeOfDay?: string | null
    weather?: string | null
  }
}

export type PlotFocusBeat = {
  id: string
  order: number
  sceneId?: string | null
  dialogue?: string | null
  beatContentJson?: string | null
  character?: { name: string } | null
  scene?: { title?: string | null; description?: string | null } | null
  prop?: { name: string } | null
}

export type PlotFocusStory = {
  chapters?: PlotFocusChapter[] | null
  storyScenes?: PlotFocusSceneLink[] | null
  timeline?: PlotFocusBeat[] | null
}

export type PlotFocusResult = {
  segmentLabel: string
  focusSnippets: string[]
}

export function normalizeSegmentKeys(input: {
  segmentKeys?: string[] | null
  segmentKey?: string | null
}): string[] {
  const out: string[] = []
  const push = (raw: unknown): void => {
    if (typeof raw !== 'string') return
    const t = raw.trim()
    if (!t || out.includes(t)) return
    out.push(t)
  }
  if (Array.isArray(input.segmentKeys)) {
    for (const k of input.segmentKeys) push(k)
  }
  push(input.segmentKey)
  return out
}

export function isEntireStoryKeys(keys: string[]): boolean {
  return keys.length === 0 || keys.some((k) => k === 'all')
}

export function plotFocusUserBlock(focus: PlotFocusResult): string {
  const body = focus.focusSnippets.filter((s) => s.trim()).join('\n\n')
  if (!body) return ''
  return [`Plot focus: ${focus.segmentLabel}`, body].join('\n')
}

function clampSnippets(
  snips: string[],
  max = PLOT_FOCUS_MAX_CHARS
): string[] {
  const out: string[] = []
  let n = 0
  for (const s of snips) {
    if (n >= max) break
    const t = s.trim()
    if (!t) continue
    const slice = t.slice(0, max - n)
    out.push(slice)
    n += slice.length
  }
  return out
}

function chapterSnippet(c: PlotFocusChapter): string | null {
  const body = c.body?.trim()
  if (!body) return null
  const head = `Chapter ${c.order + 1}${c.title?.trim() ? ` · ${c.title.trim()}` : ''}`
  return [head, body.slice(0, 900)].join('\n')
}

function chapterLabel(c: PlotFocusChapter): string {
  return `Chapter ${c.order + 1}${c.title?.trim() ? ` · ${c.title.trim()}` : ''}`
}

function sceneSnippet(
  link: PlotFocusSceneLink,
  detailed: boolean
): string {
  const s = link.scene
  const script = link.scriptOverride ?? s.script
  if (!detailed) {
    return [
      `Scene ${link.sceneNumber}: ${s.title || s.description}`,
      s.description,
      script ? String(script).slice(0, 500) : ''
    ]
      .filter(Boolean)
      .join('\n')
  }
  return [
    `Scene ${link.sceneNumber}: ${s.title || s.description}`,
    s.description,
    script ? String(script).slice(0, 800) : '',
    s.mood ? `mood: ${s.mood}` : '',
    s.timeOfDay ? `time: ${s.timeOfDay}` : '',
    s.weather ? `weather: ${s.weather}` : ''
  ]
    .filter(Boolean)
    .join('\n')
}

function beatDialogueLine(beat: PlotFocusBeat, prefix: string): string | null {
  const dialogue = beat.dialogue?.trim()
  if (dialogue) return `${prefix}: ${dialogue.slice(0, 400)}`
  const body = beat.beatContentJson?.trim()
  if (body) return `${prefix}: ${body.slice(0, 400)}`
  return null
}

function beatHasText(beat: PlotFocusBeat): boolean {
  return Boolean(beat.dialogue?.trim() || beat.beatContentJson?.trim())
}

function entireStoryFocus(
  story: PlotFocusStory,
  locale: string
): PlotFocusResult {
  const segmentLabel = PromptCatalog.t(locale, 'segment.entireStory')
  const chapterFocus = (story.chapters ?? [])
    .map((c) => chapterSnippet(c))
    .filter((s): s is string => Boolean(s))
  if (chapterFocus.length) {
    return { segmentLabel, focusSnippets: clampSnippets(chapterFocus) }
  }
  const focusSnippets: string[] = []
  for (const link of story.storyScenes ?? []) {
    focusSnippets.push(sceneSnippet(link, false))
  }
  for (const beat of (story.timeline ?? []).slice(0, 12)) {
    if (!beatHasText(beat)) continue
    const who = beat.character?.name ?? '?'
    const line = beatDialogueLine(beat, `Beat ${beat.order + 1} [${who}]`)
    if (line) focusSnippets.push(line)
  }
  return { segmentLabel, focusSnippets: clampSnippets(focusSnippets) }
}

/**
 * Merge checked chapter / scene / beat keys into prompt snippets.
 * Empty keys or `all` = whole story (chapters first). Unknown keys are ignored.
 */
export function resolvePlotFocus(
  story: PlotFocusStory,
  segmentKeys: string[],
  locale: string = 'zh-HK'
): PlotFocusResult {
  const keys = segmentKeys.map((k) => k.trim()).filter(Boolean)
  if (isEntireStoryKeys(keys)) {
    return entireStoryFocus(story, locale)
  }
  const labels: string[] = []
  const snips: string[] = []
  const chapters = story.chapters ?? []
  const scenes = story.storyScenes ?? []
  const timeline = story.timeline ?? []

  for (const key of keys) {
    if (key === 'all') continue
    if (key.startsWith('chapter:')) {
      const id = key.slice('chapter:'.length)
      const c = chapters.find((x) => x.id === id)
      if (!c) continue
      const s = chapterSnippet(c)
      if (!s) continue
      snips.push(s)
      labels.push(chapterLabel(c))
      continue
    }
    if (key.startsWith('scene:')) {
      const sceneId = key.slice('scene:'.length)
      const link = scenes.find((l) => l.sceneId === sceneId)
      if (!link) continue
      const s = link.scene
      labels.push(
        sceneLinkLabel(locale, link.sceneNumber, s.title, s.description)
      )
      snips.push(sceneSnippet(link, true))
      for (const beat of timeline) {
        if (beat.sceneId !== sceneId || !beatHasText(beat)) continue
        const who = beat.character?.name ?? '?'
        const line = beatDialogueLine(beat, `Dialogue [${who}]`)
        if (line) snips.push(line)
      }
      continue
    }
    if (key.startsWith('beat:')) {
      const entryId = key.slice('beat:'.length)
      const beat = timeline.find((e) => e.id === entryId)
      if (!beat) continue
      const who = beat.character?.name ?? unknownCharacterName(locale)
      const where = whereFromScene(beat.scene)
      const segmentLabel = beatSegmentLabel(locale, beat.order, who, where)
      labels.push(segmentLabel)
      snips.push(
        [
          segmentLabel,
          beat.dialogue ? `Dialogue: ${beat.dialogue}` : '',
          beat.beatContentJson && !beat.dialogue?.trim()
            ? String(beat.beatContentJson).slice(0, 400)
            : '',
          locationSnippet(Boolean(beat.scene), beat.scene?.description || ''),
          beat.prop ? `Prop: ${beat.prop.name}` : ''
        ]
          .filter(Boolean)
          .join('\n')
      )
    }
  }

  if (snips.length === 0) {
    return entireStoryFocus(story, locale)
  }
  return {
    segmentLabel: labels.join(' · '),
    focusSnippets: clampSnippets(snips)
  }
}
