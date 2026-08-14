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
  propName: string
  /** Spoken-line cache (may be multi-line) */
  dialogue: string
  /** Full structured screenplay for the clip */
  content: BeatContent
  /** Human-readable script for editor */
  scriptText: string
  beatContentJson: string
}

export function buildStoryBeatsSystemPrompt(
  locale: string = 'zh-HK',
  templateId?: string | null
): string {
  return assembleSystemPrompt({
    locale,
    templateId,
    family: 'copy',
    base: [
      PromptCatalog.t(locale, 'storyBeats.system'),
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
    PromptCatalog.t(loc, 'storyBeats.cast'),
    chars,
    PromptCatalog.t(loc, 'storyBeats.scenes'),
    scenes,
    PromptCatalog.t(loc, 'storyBeats.props', { props }),
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
    const characterNames: string[] = []
    if (Array.isArray(o.characterNames)) {
      for (const n of o.characterNames) {
        if (typeof n === 'string' && n.trim()) characterNames.push(n.trim())
      }
    }
    const sceneHint =
      typeof o.sceneHint === 'string'
        ? o.sceneHint.trim()
        : typeof o.sceneNumber === 'number'
          ? String(o.sceneNumber)
          : ''
    const propName = typeof o.propName === 'string' ? o.propName.trim() : ''

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
      propName,
      dialogue,
      content,
      scriptText,
      beatContentJson: beatContentToJson(content)
    })
  }
  if (!out.length) throw new AppError('VALIDATION', 'errors.noBeatsInResponse')
  return out
}

/** Map free-text cast hints to library ids (multi-character). */
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
  }
): {
  characterId: string | null
  sceneId: string | null
  propId: string | null
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  durationSeconds: number
} {
  const names = [
    beat.characterName,
    ...(beat.characterNames ?? [])
  ]
    .map((n) => n.trim())
    .filter(Boolean)
  const characterIds: string[] = []
  for (const name of names) {
    const cn = name.toLowerCase()
    const id =
      cast.characters.find((c) => c.name.toLowerCase() === cn)?.id ??
      cast.characters.find((c) => cn && c.name.toLowerCase().includes(cn))?.id ??
      null
    if (id && !characterIds.includes(id)) characterIds.push(id)
  }
  const characterId = characterIds[0] ?? null

  let sceneId: string | null = null
  const hint = beat.sceneHint.trim()
  if (hint) {
    const num = hint.match(/(\d+)/)
    if (num) {
      const n = Number(num[1])
      sceneId =
        cast.scenes.find((s) => s.sceneNumber === n)?.id ?? null
    }
    if (!sceneId) {
      const h = hint.toLowerCase()
      sceneId =
        cast.scenes.find(
          (s) =>
            (s.title && s.title.toLowerCase().includes(h)) ||
            s.description.toLowerCase().includes(h)
        )?.id ?? null
    }
  }
  if (!sceneId && cast.scenes[0]) sceneId = cast.scenes[0].id
  const sceneIds = sceneId ? [sceneId] : []

  const pn = beat.propName.toLowerCase()
  const propId = pn
    ? cast.props.find((p) => p.name.toLowerCase() === pn)?.id ??
      cast.props.find((p) => p.name.toLowerCase().includes(pn))?.id ??
      null
    : null
  const propIds = propId ? [propId] : []
  const durationSeconds = estimateBeatDurationSeconds(beat.content)

  return {
    characterId,
    sceneId,
    propId,
    characterIds,
    sceneIds,
    propIds,
    durationSeconds
  }
}
