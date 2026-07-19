/**
 * Timeline Advanced Prep Studio — cast looks + storyboard stills.
 * Pure helpers; persistence lives in MediaStore / IPC.
 */

import type { Character, TimelineEntry } from '../types/domain'
import { parseCharacterCostumes } from './characterCostumes'
import { parseCharacterGallery } from './characterGallery'
import { parseIdList } from './timelineBindings'
import { sortTimelineEntries } from './timeline'

export const STORY_CAST_PREP_VERSION = 1 as const
export const STILL_PROMPT_VERSION = 1 as const

export type ClipStillDiskStatus = 'missing' | 'ready' | 'stale'

export interface CastCharacterPrep {
  /** Selected gallery / costume image for video ref */
  refImagePath: string | null
  /** CharacterCostumeEntry.id, or null = default look */
  costumeId: string | null
}

export interface StoryCastPrep {
  version: typeof STORY_CAST_PREP_VERSION
  characters: Record<string, CastCharacterPrep>
}

export interface EntryStillPromptCache {
  version: typeof STILL_PROMPT_VERSION
  professionalPrompt: string
  userExtraPrompt?: string
  materialsSummary?: string
  sourceImagePath?: string | null
  stillPath: string
  /** Hash of beat + bindings + cast refs — mismatch ⇒ stale */
  promptHash: string
  updatedAt: string
  durationSeconds?: number
  aspectRatio?: string
}

export function emptyStoryCastPrep(): StoryCastPrep {
  return { version: STORY_CAST_PREP_VERSION, characters: {} }
}

export function parseStoryCastPrep(
  raw: string | null | undefined
): StoryCastPrep {
  if (!raw?.trim()) return emptyStoryCastPrep()
  try {
    const o = JSON.parse(raw) as Partial<StoryCastPrep>
    if (!o || typeof o !== 'object') return emptyStoryCastPrep()
    const characters: Record<string, CastCharacterPrep> = {}
    if (o.characters && typeof o.characters === 'object') {
      for (const [id, v] of Object.entries(o.characters)) {
        if (!id || !v || typeof v !== 'object') continue
        const c = v as CastCharacterPrep
        characters[id] = {
          refImagePath:
            typeof c.refImagePath === 'string' && c.refImagePath
              ? c.refImagePath
              : null,
          costumeId:
            typeof c.costumeId === 'string' && c.costumeId
              ? c.costumeId
              : null
        }
      }
    }
    return { version: STORY_CAST_PREP_VERSION, characters }
  } catch {
    return emptyStoryCastPrep()
  }
}

export function serializeStoryCastPrep(prep: StoryCastPrep): string {
  return JSON.stringify({
    version: STORY_CAST_PREP_VERSION,
    characters: prep.characters
  })
}

export function parseEntryStillPromptCache(
  raw: string | null | undefined
): EntryStillPromptCache | null {
  if (!raw?.trim()) return null
  try {
    const o = JSON.parse(raw) as Partial<EntryStillPromptCache>
    if (!o?.professionalPrompt?.trim() || !o.stillPath?.trim()) return null
    return {
      version: STILL_PROMPT_VERSION,
      professionalPrompt: o.professionalPrompt.trim(),
      userExtraPrompt:
        typeof o.userExtraPrompt === 'string' ? o.userExtraPrompt : '',
      materialsSummary:
        typeof o.materialsSummary === 'string' ? o.materialsSummary : undefined,
      sourceImagePath:
        typeof o.sourceImagePath === 'string' ? o.sourceImagePath : null,
      stillPath: o.stillPath.trim(),
      promptHash: typeof o.promptHash === 'string' ? o.promptHash : '',
      updatedAt:
        typeof o.updatedAt === 'string'
          ? o.updatedAt
          : new Date().toISOString(),
      durationSeconds:
        typeof o.durationSeconds === 'number' ? o.durationSeconds : undefined,
      aspectRatio:
        typeof o.aspectRatio === 'string' ? o.aspectRatio : undefined
    }
  } catch {
    return null
  }
}

export function serializeEntryStillPromptCache(
  cache: EntryStillPromptCache
): string {
  return JSON.stringify({ ...cache, version: STILL_PROMPT_VERSION })
}

/** Stable short hash for stale detection (not cryptographic). */
export function simplePromptHash(parts: Array<string | null | undefined>): string {
  const s = parts.map((p) => (p ?? '').trim()).join('\u001f')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16)
}

export function buildClipPrepHash(input: {
  entryId: string
  dialogue?: string | null
  beatContentJson?: string | null
  characterIds: string[]
  sceneIds: string[]
  propIds: string[]
  castRefPath?: string | null
  styleNote?: string | null
  seconds?: number
}): string {
  return simplePromptHash([
    input.entryId,
    input.dialogue,
    input.beatContentJson,
    input.characterIds.join(','),
    input.sceneIds.join(','),
    input.propIds.join(','),
    input.castRefPath,
    input.styleNote,
    input.seconds != null ? String(input.seconds) : null
  ])
}

export function clipStillStatus(options: {
  stillFileExists: boolean
  cache: EntryStillPromptCache | null
  currentHash: string
}): ClipStillDiskStatus {
  if (!options.stillFileExists) return 'missing'
  if (
    options.cache?.promptHash &&
    options.currentHash &&
    options.cache.promptHash !== options.currentHash
  ) {
    return 'stale'
  }
  return 'ready'
}

export function canSkipStillToReview(options: {
  stillFileExists: boolean
  cache: EntryStillPromptCache | null
  currentHash: string
}): boolean {
  if (!options.stillFileExists) return false
  const st = clipStillStatus(options)
  if (st === 'missing') return false
  // Stale still can still open review but should re-polish; allow skip image gen
  return true
}

/** Character ids used on timeline (primary + multi). */
export function collectTimelineCharacterIds(
  entries: readonly TimelineEntry[]
): string[] {
  const set = new Set<string>()
  for (const e of entries) {
    const raw = (e as { characterIds?: string | string[] | null }).characterIds
    let multi: string[]
    if (Array.isArray(raw)) {
      multi = raw.filter((x): x is string => typeof x === 'string' && !!x.trim())
      if (multi.length === 0 && e.characterId) multi = [e.characterId]
    } else {
      multi = parseIdList(
        typeof raw === 'string' ? raw : null,
        e.characterId
      )
    }
    for (const id of multi) {
      if (id) set.add(id)
    }
  }
  return [...set]
}

export interface AdvancedCastCardModel {
  characterId: string
  name: string
  description: string
  gallery: Array<{ id: string; path: string; label: string; kind: string }>
  costumes: Array<{
    id: string
    name: string
    description: string
    imagePath: string | null
    selectable: boolean
  }>
  selectedRefImagePath: string | null
  selectedCostumeId: string | null
  hasAnyImage: boolean
}

export function buildCastCardModel(
  character: Character,
  prep: CastCharacterPrep | undefined
): AdvancedCastCardModel {
  const gallery = parseCharacterGallery(character.refGalleryJson, {
    refImagePath: character.refImagePath,
    refSheetPath: character.refSheetPath
  }).map((g) => ({
    id: g.id,
    path: g.path,
    label: g.label,
    kind: g.kind
  }))
  const costumes = parseCharacterCostumes(character.costumesJson).map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    imagePath: c.imagePath ?? null,
    selectable: Boolean(c.imagePath?.trim())
  }))
  const defaultRef =
    character.refSheetPath || character.refImagePath || gallery[0]?.path || null
  let selectedRef = prep?.refImagePath?.trim() || null
  let selectedCostumeId = prep?.costumeId?.trim() || null
  if (selectedCostumeId) {
    const cos = costumes.find((c) => c.id === selectedCostumeId)
    if (cos?.imagePath) {
      selectedRef = cos.imagePath
    } else if (!cos) {
      selectedCostumeId = null
    }
  }
  if (!selectedRef) selectedRef = defaultRef
  const hasAnyImage = Boolean(
    selectedRef ||
      defaultRef ||
      gallery.length > 0 ||
      costumes.some((c) => c.selectable)
  )
  return {
    characterId: character.id,
    name: character.name,
    description: character.description,
    gallery,
    costumes,
    selectedRefImagePath: selectedRef,
    selectedCostumeId,
    hasAnyImage
  }
}

/** Resolve cast ref for primary character from story prep. */
export function resolveCastRefFromPrep(
  primaryCharacterId: string | null | undefined,
  prep: StoryCastPrep
): string | null {
  if (!primaryCharacterId) return null
  const c = prep.characters[primaryCharacterId]
  return c?.refImagePath?.trim() || null
}

export interface StoryboardCellModel {
  entryId: string
  order: number
  displayIndex: number
  startTime: number
  endTime: number
  label: string
  stillPath: string
  stillStatus: ClipStillDiskStatus
  mediaStatus: string
  continuityKind: 'first' | 'locked' | 'text-only'
  characterNames: string[]
  hasCachedPrompt: boolean
}

export function orderedTimelineEntries(
  entries: readonly TimelineEntry[]
): TimelineEntry[] {
  return sortTimelineEntries(entries)
}

export function applyCostumeSelection(
  prep: StoryCastPrep,
  characterId: string,
  costumeId: string | null,
  costumeImagePath: string | null
): StoryCastPrep {
  const next = {
    ...prep,
    characters: { ...prep.characters }
  }
  const prev = next.characters[characterId] ?? {
    refImagePath: null,
    costumeId: null
  }
  if (!costumeId) {
    next.characters[characterId] = {
      refImagePath: prev.refImagePath,
      costumeId: null
    }
    return next
  }
  next.characters[characterId] = {
    costumeId,
    refImagePath: costumeImagePath?.trim() || prev.refImagePath
  }
  return next
}

export function applyGallerySelection(
  prep: StoryCastPrep,
  characterId: string,
  imagePath: string
): StoryCastPrep {
  const next = {
    ...prep,
    characters: { ...prep.characters }
  }
  // Gallery pick is the ref; clear costume so look dropdown does not override it.
  next.characters[characterId] = {
    costumeId: null,
    refImagePath: imagePath.trim() || null
  }
  return next
}
