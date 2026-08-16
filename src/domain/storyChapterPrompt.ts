/**
 * AI prompts + JSON extractors for story chapters and chapter→cast extraction.
 */
import { PromptCatalog, resolvePromptContext } from '../prompts'
import { assembleSystemPrompt } from './promptTemplates'
import { AppError } from '../types/errors'
import type { Chapter } from '../types/domain'

export interface StoryChapterDraft {
  title: string
  body: string
}

export interface CastCharacterDraft {
  name: string
  description: string
  appearance: string
  personality: string
  costume: string
  roleNote: string
}

export interface CastSceneDraft {
  title: string
  description: string
  locationType: string
  timeOfDay: string
  mood: string
}

export interface CastPropDraft {
  name: string
  description: string
}

export interface CastActionDraft {
  name: string
  description: string
  motionNotes: string
  intention: string
}

export interface CastFromChaptersExtract {
  characters: CastCharacterDraft[]
  scenes: CastSceneDraft[]
  props: CastPropDraft[]
  actions: CastActionDraft[]
}

export type CastPlanAction = 'skip' | 'link' | 'create'

export interface CastPlanItem<T> {
  action: CastPlanAction
  existingId?: string
  draft: T
}

export interface CastPlan {
  characters: CastPlanItem<CastCharacterDraft>[]
  scenes: CastPlanItem<CastSceneDraft>[]
  props: CastPlanItem<CastPropDraft>[]
  actions: CastPlanItem<CastActionDraft>[]
}

export const CHAPTER_AI_COUNT_MIN = 2
export const CHAPTER_AI_COUNT_MAX = 8
export const CHAPTER_AI_COUNT_DEFAULT = 4
export const CHAPTER_AI_WORDS_MIN = 60
export const CHAPTER_AI_WORDS_MAX = 400
export const CHAPTER_AI_WORDS_DEFAULT = 120

function clampInt(
  raw: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const n = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, Math.round(n)))
}

export function clampChapterAiCount(raw: unknown): number {
  return clampInt(
    raw,
    CHAPTER_AI_COUNT_MIN,
    CHAPTER_AI_COUNT_MAX,
    CHAPTER_AI_COUNT_DEFAULT
  )
}

export function clampChapterAiWords(raw: unknown): number {
  return clampInt(
    raw,
    CHAPTER_AI_WORDS_MIN,
    CHAPTER_AI_WORDS_MAX,
    CHAPTER_AI_WORDS_DEFAULT
  )
}

export function chapterAiMaxTokens(count: number, words: number): number {
  return Math.min(3500, Math.max(1200, count * words * 2 + 400))
}

export function hasNonEmptyChapterBody(
  chapters: Array<{ body?: string | null }>
): boolean {
  return chapters.some((c) => (c.body ?? '').trim().length > 0)
}

/** Chapters with body, optionally restricted to selected ids (keeps story order). */
export function filterChaptersForPrompt<
  T extends { id: string; body?: string | null }
>(chapters: T[], ids?: string[] | null): T[] {
  const withBody = chapters.filter((c) => (c.body ?? '').trim().length > 0)
  if (ids == null) return withBody
  if (ids.length === 0) return []
  const want = new Set(ids)
  return withBody.filter((c) => want.has(c.id))
}

export function formatChaptersForPrompt(
  chapters: Array<Pick<Chapter, 'order' | 'title' | 'body'>>,
  locale: string = 'zh-HK'
): string {
  if (chapters.length === 0) return ''
  return chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c, i) => {
      const n = i + 1
      const title = c.title.trim() || String(n)
      const body = c.body.trim()
      return PromptCatalog.t(locale, 'storyBeats.chapterBlock', {
        n: String(n),
        title,
        body
      })
    })
    .join('\n\n')
}

export function buildStoryChaptersSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null,
  size?: { count?: unknown; words?: unknown }
): string {
  const ctx = resolvePromptContext(locale)
  const count = clampChapterAiCount(size?.count)
  const words = clampChapterAiWords(size?.words)
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'storyChapters.system', { count, words }),
      ctx.outputLock
    ].join('\n')
  })
}

export function buildStoryChaptersUserPrompt(options: {
  title: string
  styleNote?: string | null
  hardRules?: string | null
  idea?: string
  locale?: string
}): string {
  const loc = options.locale || 'zh-HK'
  return [
    PromptCatalog.t(loc, 'storyChapters.userLead'),
    PromptCatalog.t(loc, 'storyChapters.story', { title: options.title }),
    options.styleNote?.trim()
      ? PromptCatalog.t(loc, 'storyChapters.style', {
          style: options.styleNote.trim()
        })
      : '',
    options.hardRules?.trim()
      ? PromptCatalog.t(loc, 'storyChapters.rules', {
          rules: options.hardRules.trim()
        })
      : '',
    options.idea?.trim()
      ? PromptCatalog.t(loc, 'storyChapters.userDir', {
          idea: options.idea.trim()
        })
      : '',
    PromptCatalog.t(loc, 'storyChapters.returnJson')
  ]
    .filter(Boolean)
    .join('\n')
}

export function buildChapterPolishSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const ctx = resolvePromptContext(locale)
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'storyChapters.polishSystem'),
      ctx.outputLock
    ].join('\n')
  })
}

export function buildChapterPolishUserPrompt(options: {
  storyTitle: string
  title: string
  body: string
  idea?: string
  locale?: string
}): string {
  const loc = options.locale || 'zh-HK'
  return PromptCatalog.t(loc, 'storyChapters.polishUser', {
    story: options.storyTitle,
    title: options.title,
    body: options.body,
    idea: options.idea?.trim() || ''
  })
}

export function buildCastFromChaptersSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const ctx = resolvePromptContext(locale)
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'storyCastFromChapters.system'),
      ctx.outputLock
    ].join('\n')
  })
}

export function buildCastFromChaptersUserPrompt(options: {
  title: string
  styleNote?: string | null
  chaptersText: string
  existingNames?: string
  locale?: string
}): string {
  const loc = options.locale || 'zh-HK'
  return [
    PromptCatalog.t(loc, 'storyCastFromChapters.userLead'),
    PromptCatalog.t(loc, 'storyCastFromChapters.story', {
      title: options.title
    }),
    options.styleNote?.trim()
      ? PromptCatalog.t(loc, 'storyCastFromChapters.style', {
          style: options.styleNote.trim()
        })
      : '',
    PromptCatalog.t(loc, 'storyCastFromChapters.chapters', {
      chapters: options.chaptersText
    }),
    options.existingNames?.trim()
      ? PromptCatalog.t(loc, 'storyCastFromChapters.existingCast', {
          names: options.existingNames.trim()
        })
      : '',
    PromptCatalog.t(loc, 'storyCastFromChapters.returnJson')
  ]
    .filter(Boolean)
    .join('\n')
}

function unwrapJsonText(text: string): string {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  return s
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

export function extractStoryChaptersJson(text: string): StoryChapterDraft[] {
  let s = unwrapJsonText(text)
  const arrMatch = s.match(/\[[\s\S]*\]/)
  if (arrMatch) s = arrMatch[0]
  const parsed = JSON.parse(s) as unknown
  let list: unknown[] | null = null
  if (Array.isArray(parsed)) list = parsed
  else if (parsed && typeof parsed === 'object') {
    const o = parsed as { chapters?: unknown; title?: unknown; body?: unknown }
    if (Array.isArray(o.chapters)) list = o.chapters
    else if (typeof o.title === 'string' || typeof o.body === 'string') {
      list = [parsed]
    }
  }
  if (!list) throw new AppError('VALIDATION', 'errors.chaptersMustBeArray')
  const out: StoryChapterDraft[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const title = str(o.title)
    const body = str(o.body) || str(o.text) || str(o.content)
    if (!title && !body) continue
    out.push({ title, body })
  }
  if (out.length === 0) {
    throw new AppError('VALIDATION', 'errors.chaptersMustBeArray')
  }
  return out
}

export function extractCastFromChaptersJson(
  text: string
): CastFromChaptersExtract {
  let s = unwrapJsonText(text)
  const brace = s.match(/\{[\s\S]*\}/)
  if (brace) s = brace[0]
  const parsed = JSON.parse(s) as Record<string, unknown>
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new AppError('VALIDATION', 'errors.castExtractInvalid')
  }
  const characters: CastCharacterDraft[] = []
  if (Array.isArray(parsed.characters)) {
    for (const raw of parsed.characters) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const name = str(o.name)
      if (!name) continue
      characters.push({
        name,
        description: str(o.description) || name,
        appearance: str(o.appearance),
        personality: str(o.personality),
        costume: str(o.costume),
        roleNote: str(o.roleNote)
      })
    }
  }
  const scenes: CastSceneDraft[] = []
  if (Array.isArray(parsed.scenes)) {
    for (const raw of parsed.scenes) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const title = str(o.title)
      const description = str(o.description)
      if (!title && !description) continue
      scenes.push({
        title: title || description.slice(0, 40),
        description: description || title,
        locationType: str(o.locationType),
        timeOfDay: str(o.timeOfDay),
        mood: str(o.mood)
      })
    }
  }
  const props: CastPropDraft[] = []
  if (Array.isArray(parsed.props)) {
    for (const raw of parsed.props) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const name = str(o.name)
      if (!name) continue
      props.push({
        name,
        description: str(o.description) || name
      })
    }
  }
  const actions: CastActionDraft[] = []
  if (Array.isArray(parsed.actions)) {
    for (const raw of parsed.actions) {
      if (!raw || typeof raw !== 'object') continue
      const o = raw as Record<string, unknown>
      const name = str(o.name)
      if (!name) continue
      actions.push({
        name,
        description: str(o.description) || name,
        motionNotes: str(o.motionNotes),
        intention: str(o.intention)
      })
    }
  }
  return { characters, scenes, props, actions }
}

export function nameKey(value: string): string {
  return value.trim().toLowerCase()
}

function findByName<T extends { id: string; name: string }>(
  rows: T[],
  name: string
): T | undefined {
  const k = nameKey(name)
  return rows.find((r) => nameKey(r.name) === k)
}

function findScene(
  rows: Array<{ id: string; title?: string | null; description: string }>,
  title: string,
  description: string
): { id: string } | undefined {
  const tk = nameKey(title)
  const byTitle = rows.find((r) => nameKey(r.title ?? '') === tk && tk)
  if (byTitle) return byTitle
  const dk = nameKey(description).slice(0, 80)
  if (!dk) return undefined
  return rows.find((r) => nameKey(r.description).slice(0, 80) === dk)
}

export function classifyCastDrafts(options: {
  drafts: CastFromChaptersExtract
  linked: {
    characters: Array<{ id: string; name: string }>
    scenes: Array<{ id: string; title?: string | null; description: string }>
    props: Array<{ id: string; name: string }>
    actions: Array<{ id: string; name: string }>
  }
  library: {
    characters: Array<{ id: string; name: string }>
    scenes: Array<{ id: string; title?: string | null; description: string }>
    props: Array<{ id: string; name: string }>
    actions: Array<{ id: string; name: string }>
  }
}): CastPlan {
  const characters = options.drafts.characters.map((draft) => {
    const linked = findByName(options.linked.characters, draft.name)
    if (linked) return { action: 'skip' as const, existingId: linked.id, draft }
    const lib = findByName(options.library.characters, draft.name)
    if (lib) return { action: 'link' as const, existingId: lib.id, draft }
    return { action: 'create' as const, draft }
  })
  const scenes = options.drafts.scenes.map((draft) => {
    const linked = findScene(
      options.linked.scenes,
      draft.title,
      draft.description
    )
    if (linked) return { action: 'skip' as const, existingId: linked.id, draft }
    const lib = findScene(options.library.scenes, draft.title, draft.description)
    if (lib) return { action: 'link' as const, existingId: lib.id, draft }
    return { action: 'create' as const, draft }
  })
  const props = options.drafts.props.map((draft) => {
    const linked = findByName(options.linked.props, draft.name)
    if (linked) return { action: 'skip' as const, existingId: linked.id, draft }
    const lib = findByName(options.library.props, draft.name)
    if (lib) return { action: 'link' as const, existingId: lib.id, draft }
    return { action: 'create' as const, draft }
  })
  const actions = options.drafts.actions.map((draft) => {
    const linked = findByName(options.linked.actions, draft.name)
    if (linked) return { action: 'skip' as const, existingId: linked.id, draft }
    const lib = findByName(options.library.actions, draft.name)
    if (lib) return { action: 'link' as const, existingId: lib.id, draft }
    return { action: 'create' as const, draft }
  })
  return { characters, scenes, props, actions }
}

export function summarizeCastPlan(plan: CastPlan): {
  create: number
  link: number
  skip: number
} {
  const items = [
    ...plan.characters,
    ...plan.scenes,
    ...plan.props,
    ...plan.actions
  ]
  return {
    create: items.filter((i) => i.action === 'create').length,
    link: items.filter((i) => i.action === 'link').length,
    skip: items.filter((i) => i.action === 'skip').length
  }
}
