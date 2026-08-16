/**
 * AI prompts for story style bible + short-drama script beats (timeline).
 */

import { PromptCatalog, resolvePromptContext } from '../prompts'
import { assembleSystemPrompt } from './promptTemplates'
import { buildImproveUserPrompt } from './aiImprovePrompt'
import type { BeatContent, BeatUnit } from './beatContent'
import { AppError } from '../types/errors'
import {
  beatContentToJson,
  estimateBeatDurationSeconds,
  normalizeBeatContent,
  serializeBeatContent,
  spokenSummaryFromBeatContent
} from './beatContent'
import { normalizeHardRules } from './promptHardRules'
import {
  parseSpokenLanguageInput,
  speechLanguageLockLine
} from './speechLanguageLock'
import {
  MAX_BEAT_ACTIONS,
  MAX_BEAT_CHARACTERS,
  MAX_BEAT_PROPS,
  MAX_BEAT_SCENES,
  clampIdList
} from './timelineBindings'

export function beatAiMaxBeats(chapterCount: unknown): number {
  const n =
    typeof chapterCount === 'number' ? chapterCount : Number(chapterCount)
  const chapters = Number.isFinite(n) && n > 0 ? Math.round(n) : 4
  return Math.min(16, Math.max(6, chapters * 3))
}

export function beatAiMaxTokens(maxBeats: number): number {
  return Math.min(3500, Math.max(1600, maxBeats * 220 + 400))
}

export function buildStoryMetaSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  const ctx = resolvePromptContext(locale)
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'storyMeta.system'),
      ctx.pack.hardRulesInstruction,
      ctx.outputLock
    ].join(' ')
  })
}

export function buildStoryMetaUserPrompt(options: {
  title: string
  idea?: string
  existingStyleNote?: string | null
  existingHardRules?: string | null
  /** Cast / scene / prop blurbs for richer style direction */
  contextSnippets?: string[]
  locale?: string
}): string {
  const extras =
    options.contextSnippets?.filter(Boolean).length
      ? [
          {
            labelKey: 'storyMeta.contextLabel' as const,
            body: options.contextSnippets!.filter(Boolean).join('\n')
          }
        ]
      : []
  return buildImproveUserPrompt({
    locale: options.locale,
    idea: options.idea?.trim() || options.title,
    draft: {
      title: options.title,
      styleNote: options.existingStyleNote ?? '',
      hardRules: options.existingHardRules ?? ''
    },
    draftLabelKey: 'storyMeta.draftLabel',
    extraBlocks: extras,
    createLabelKey: 'storyMeta.createLabel',
    emptyIdeaPolishKey: 'storyMeta.emptyPolish',
    closingKey: 'storyMeta.closing'
  })
}

export type StoryMetaExtract = {
  styleNote: string
  hardRules: string
}

export function extractStoryMetaJson(
  text: string,
  _locale: string = 'zh-HK'
): StoryMetaExtract {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const brace = s.match(/\{[\s\S]*\}/)
  if (brace) s = brace[0]
  const parsed = JSON.parse(s) as {
    styleNote?: unknown
    hardRules?: unknown
  }
  const note =
    typeof parsed.styleNote === 'string' ? parsed.styleNote.trim() : ''
  if (!note) throw new AppError('VALIDATION', 'errors.styleNoteRequired')
  const rules =
    normalizeHardRules(
      typeof parsed.hardRules === 'string' ? parsed.hardRules : null
    ) || ''
  return { styleNote: note, hardRules: rules }
}

/** @deprecated prefer extractStoryMetaJson */
export function extractStyleNoteJson(text: string): string {
  return extractStoryMetaJson(text).styleNote
}

export interface StoryBeatDraft {
  /** Primary character name as in cast, or empty */
  characterName: string
  /** Extra character names appearing in this beat (dialogue/action who) */
  characterNames: string[]
  /** 1-based scene number preferred, or scene title fragment */
  sceneHint: string
  /** Extra scene titles / numbers appearing in this clip */
  sceneHints: string[]
  propName: string
  propNames: string[]
  actionName: string
  actionNames: string[]
  /** Spoken-line cache (may be multi-line) */
  dialogue: string
  /** Full structured screenplay for the clip */
  content: BeatContent
  /** Human-readable script for editor */
  scriptText: string
  beatContentJson: string
}

function collectTrimmedStrings(...sources: unknown[]): string[] {
  const out: string[] = []
  const add = (v: unknown) => {
    if (typeof v === 'string') {
      const t = v.trim()
      if (t && !out.includes(t)) out.push(t)
      return
    }
    if (typeof v === 'number' && Number.isFinite(v)) {
      const t = String(v)
      if (!out.includes(t)) out.push(t)
      return
    }
    if (Array.isArray(v)) {
      for (const x of v) add(x)
    }
  }
  for (const s of sources) add(s)
  return out
}

function compactKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, '')
}

function hasCjk(value: string): boolean {
  return /[\u3400-\u9fff]/.test(value)
}

/** Full name, or (CJK) any 2-char slice of the library name inside the beat text. */
function libraryNameHitsHaystack(
  name: string,
  haystack: string,
  compactHay: string
): boolean {
  const n = name.trim()
  if (n.length <= 1) return false
  const nl = n.toLowerCase()
  const nc = compactKey(n)
  if (haystack.includes(nl) || (nc.length > 1 && compactHay.includes(nc))) {
    return true
  }
  if (!hasCjk(n) || nc.length < 2) return false
  for (let i = 0; i <= nc.length - 2; i++) {
    if (compactHay.includes(nc.slice(i, i + 2))) return true
  }
  return false
}

type NameMatchRank = 0 | 1 | 2 | 3

function nameMatchRank(name: string, hint: string): NameMatchRank | null {
  const n = name.trim()
  const h = hint.trim()
  if (!n || !h) return null
  const nl = n.toLowerCase()
  const hl = h.toLowerCase()
  if (nl === hl) return 0
  if (nl.includes(hl)) return 1
  if (hl.includes(nl)) return 2
  const nc = compactKey(n)
  const hc = compactKey(h)
  if (nc && hc && (nc === hc || nc.includes(hc) || hc.includes(nc))) return 3
  return null
}

/** exact → lib name contains hint → hint contains lib name → whitespace-stripped */
export function matchLibraryIds(
  hints: string[],
  lib: Array<{ id: string; name: string }>,
  max: number
): string[] {
  const ids: string[] = []
  for (const raw of hints) {
    if (ids.length >= max) break
    const hint = raw.trim()
    if (!hint) continue
    let best: { id: string; rank: NameMatchRank } | null = null
    for (const item of lib) {
      if (ids.includes(item.id)) continue
      const rank = nameMatchRank(item.name, hint)
      if (rank === null) continue
      if (!best || rank < best.rank) best = { id: item.id, rank }
      if (best.rank === 0) break
    }
    if (best && !ids.includes(best.id)) ids.push(best.id)
  }
  return clampIdList(ids, max)
}

function matchSceneIds(
  hints: string[],
  scenes: Array<{
    id: string
    sceneNumber?: number
    title?: string | null
    description: string
  }>,
  max: number
): string[] {
  const ids: string[] = []
  for (const raw of hints) {
    if (ids.length >= max) break
    const hint = raw.trim()
    if (!hint) continue
    const num = hint.match(/(\d+)/)
    if (num) {
      const n = Number(num[1])
      const byNum = scenes.find(
        (s) => s.sceneNumber === n && !ids.includes(s.id)
      )
      if (byNum) {
        ids.push(byNum.id)
        continue
      }
    }
    const lib = scenes
      .filter((s) => !ids.includes(s.id))
      .map((s) => ({
        id: s.id,
        name: [s.title, s.description].filter(Boolean).join(' ')
      }))
    const hit = matchLibraryIds([hint], lib, 1)[0]
    if (hit) ids.push(hit)
  }
  return clampIdList(ids, max)
}

export function buildStoryBeatsSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null,
  size?: { maxBeats?: unknown }
): string {
  const maxBeats =
    typeof size?.maxBeats === 'number' && Number.isFinite(size.maxBeats)
      ? Math.min(16, Math.max(6, Math.round(size.maxBeats)))
      : beatAiMaxBeats(4)
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'storyBeats.system', { maxBeats }),
      PromptCatalog.context(locale).outputLock
    ].join('\n')
  })
}

export function buildStoryBeatsUserPrompt(options: {
  title: string
  styleNote?: string | null
  idea?: string
  characters: Array<{
    name: string
    description?: string
    spokenLanguages?: string | string[] | null
  }>
  scenes: Array<{ sceneNumber?: number; title?: string | null; description: string }>
  props: Array<{ name: string; description?: string }>
  actions?: Array<{
    name: string
    description?: string | null
    motionNotes?: string | null
  }>
  chaptersText?: string
  locale?: string
}): string {
  const loc = options.locale || 'zh-HK'
  const chars =
    options.characters
      .map((c) => {
        const lock = speechLanguageLockLine({
          name: c.name,
          codes: parseSpokenLanguageInput(c.spokenLanguages),
          locale: loc
        })
        const desc = c.description ? `: ${c.description.slice(0, 160)}` : ''
        return `- ${c.name}${desc}\n  ${lock}`
      })
      .join('\n') || PromptCatalog.t(loc, 'storyBeats.noCast')
  const scenes =
    options.scenes
      .map(
        (s) =>
          `- #${s.sceneNumber ?? '?'} ${s.title || s.description.slice(0, 100)}`
      )
      .join('\n') || PromptCatalog.t(loc, 'storyBeats.noScenes')
  const props =
    options.props
      .map(
        (p) =>
          p.description
            ? `${p.name} (${p.description.slice(0, 60)})`
            : p.name
      )
      .join(', ') || PromptCatalog.t(loc, 'storyBeats.none')
  const actions =
    (options.actions ?? [])
      .map((a) => {
        const extra = [a.motionNotes, a.description]
          .filter((x): x is string => Boolean(x && String(x).trim()))
          .join(' · ')
          .slice(0, 80)
        return extra ? `${a.name} (${extra})` : a.name
      })
      .join(', ') || PromptCatalog.t(loc, 'storyBeats.none')
  return [
    PromptCatalog.t(loc, 'storyBeats.userLead'),
    PromptCatalog.t(loc, 'storyBeats.eachBeat'),
    PromptCatalog.t(loc, 'storyBeats.story', { title: options.title }),
    options.styleNote?.trim()
      ? PromptCatalog.t(loc, 'storyBeats.style', {
          style: options.styleNote.trim()
        })
      : '',
    options.idea?.trim()
      ? PromptCatalog.t(loc, 'storyBeats.userDir', {
          idea: options.idea.trim()
        })
      : '',
    options.chaptersText?.trim()
      ? [
          PromptCatalog.t(loc, 'storyBeats.chapters'),
          options.chaptersText.trim()
        ].join('\n')
      : '',
    PromptCatalog.t(loc, 'storyBeats.cast'),
    chars,
    PromptCatalog.t(loc, 'storyBeats.scenes'),
    scenes,
    PromptCatalog.t(loc, 'storyBeats.props', { props }),
    PromptCatalog.t(loc, 'storyBeats.actions', { actions }),
    PromptCatalog.t(loc, 'storyBeats.returnJson')
  ]
    .filter(Boolean)
    .join('\n')
}

function unitsFromLegacyDialogue(dialogue: string): BeatUnit[] {
  const t = dialogue.trim()
  if (!t) return []
  // If it looks like pure speech
  if (t.length < 80 && !/[，。；]/.test(t.slice(10))) {
    return [{ type: 'dialogue', who: '', line: t }]
  }
  return [{ type: 'action', text: t }]
}

export function extractStoryBeatsJson(
  text: string,
  locale: string = 'zh-HK'
): StoryBeatDraft[] {
  let s = text.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) s = fence[1].trim()
  const arrMatch = s.match(/\[[\s\S]*\]/)
  if (arrMatch) s = arrMatch[0]
  const parsed = JSON.parse(s) as unknown
  if (!Array.isArray(parsed)) throw new AppError('VALIDATION', 'errors.beatsMustBeArray')
  const out: StoryBeatDraft[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const characterName =
      typeof o.characterName === 'string' ? o.characterName.trim() : ''
    const characterNames = collectTrimmedStrings(
      o.characterName,
      o.characterNames
    )
    const sceneHints = collectTrimmedStrings(
      o.sceneHint,
      o.sceneNumber,
      o.sceneHints
    )
    const sceneHint = sceneHints[0] ?? ''
    const propNames = collectTrimmedStrings(o.propName, o.propNames)
    const propName = propNames[0] ?? ''
    const actionNames = collectTrimmedStrings(o.actionName, o.actionNames)

    let content = normalizeBeatContent({
      version: 1,
      mood: o.mood,
      atmosphere: o.atmosphere,
      camera: o.camera,
      sfx: o.sfx,
      units: o.units
    })

    // Legacy: single dialogue / line / script field
    if (!content) {
      const legacy =
        typeof o.script === 'string'
          ? o.script.trim()
          : typeof o.dialogue === 'string'
            ? o.dialogue.trim()
            : typeof o.line === 'string'
              ? o.line.trim()
              : ''
      if (!legacy) continue
      const units = unitsFromLegacyDialogue(legacy)
      content = {
        version: 1,
        units:
          characterName && units[0]?.type === 'dialogue'
            ? [{ ...units[0], who: characterName || units[0].who }]
            : units
      }
    }

    // Ensure primary character name collected
    if (characterName && !characterNames.includes(characterName)) {
      characterNames.unshift(characterName)
    }
    for (const u of content.units) {
      if ('who' in u && u.who?.trim() && !characterNames.includes(u.who.trim())) {
        characterNames.push(u.who.trim())
      }
    }

    const scriptText = serializeBeatContent(content, locale)
    const spoken = spokenSummaryFromBeatContent(content)
    const legacyDlg =
      typeof o.dialogue === 'string' ? o.dialogue.trim() : ''
    const dialogue = spoken || legacyDlg || scriptText
    if (!content.units.length && !content.mood && !dialogue) continue

    out.push({
      characterName: characterName || characterNames[0] || '',
      characterNames,
      sceneHint,
      sceneHints,
      propName,
      propNames,
      actionName: actionNames[0] || '',
      actionNames,
      dialogue,
      content,
      scriptText,
      beatContentJson: beatContentToJson(content)
    })
  }
  if (!out.length) throw new AppError('VALIDATION', 'errors.noBeatsInResponse')
  return out
}

/** Map free-text cast hints to library ids (multi-select, clamped). */
export function resolveBeatIds(
  beat: StoryBeatDraft,
  cast: {
    characters: Array<{ id: string; name: string }>
    scenes: Array<{
      id: string
      sceneNumber?: number
      title?: string | null
      description: string
    }>
    props: Array<{ id: string; name: string }>
    actions?: Array<{ id: string; name: string }>
  }
): {
  characterId: string | null
  sceneId: string | null
  propId: string | null
  actionId: string | null
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  actionIds: string[]
  durationSeconds: number
} {
  const whoHints: string[] = []
  for (const u of beat.content?.units ?? []) {
    if ('who' in u && typeof u.who === 'string' && u.who.trim()) {
      whoHints.push(u.who.trim())
    }
  }
  const characterHints = collectTrimmedStrings(
    beat.characterName,
    beat.characterNames,
    whoHints
  )
  const characterIds = matchLibraryIds(
    characterHints,
    cast.characters,
    MAX_BEAT_CHARACTERS
  )
  const characterId = characterIds[0] ?? null

  const sceneHints = collectTrimmedStrings(beat.sceneHint, beat.sceneHints)
  let sceneIds = matchSceneIds(sceneHints, cast.scenes, MAX_BEAT_SCENES)
  if (!sceneIds.length && !sceneHints.length && cast.scenes[0]) {
    sceneIds = [cast.scenes[0].id]
  }
  const sceneId = sceneIds[0] ?? null

  const propHints = collectTrimmedStrings(beat.propName, beat.propNames)
  const propIds = matchLibraryIds(propHints, cast.props, MAX_BEAT_PROPS)
  const propId = propIds[0] ?? null

  const actionLib = cast.actions ?? []
  const actionHints = collectTrimmedStrings(beat.actionName, beat.actionNames)
  let actionIds = matchLibraryIds(actionHints, actionLib, MAX_BEAT_ACTIONS)
  const actionUnits = (beat.content?.units ?? []).filter(
    (u) => u.type === 'action'
  )
  if (!actionIds.length && actionLib.length) {
    const haystack = [
      ...actionUnits.map((u) => ('text' in u ? u.text : '')),
      beat.scriptText,
      beat.dialogue
    ]
      .join('\n')
      .toLowerCase()
    const compactHay = compactKey(haystack)
    for (const a of actionLib) {
      if (actionIds.length >= MAX_BEAT_ACTIONS) break
      if (!libraryNameHitsHaystack(a.name, haystack, compactHay)) continue
      if (!actionIds.includes(a.id)) actionIds.push(a.id)
    }
    actionIds = clampIdList(actionIds, MAX_BEAT_ACTIONS)
  }
  // Story-linked actions are the user's palette. A motion beat must not
  // stay unbound just because the model paraphrased the library title.
  if (!actionIds.length && actionLib.length && actionUnits.length) {
    actionIds = clampIdList(
      actionLib.map((a) => a.id),
      MAX_BEAT_ACTIONS
    )
  }
  const actionId = actionIds[0] ?? null
  const durationSeconds = estimateBeatDurationSeconds(beat.content)

  return {
    characterId,
    sceneId,
    propId,
    actionId,
    characterIds,
    sceneIds,
    propIds,
    actionIds,
    durationSeconds
  }
}
