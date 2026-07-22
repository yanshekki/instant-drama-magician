/**
 * Timeline Advanced Prep — cast looks + storyboard stills orchestration.
 */
import { existsSync, unlinkSync } from 'fs'
import type { PrismaClient } from '../../types/prisma'
import type { Character, TimelineEntry } from '../../types/domain'
import type { MediaStore } from '../../infrastructure/media/MediaStore'
import { FfmpegService } from '../../infrastructure/ffmpeg/FfmpegService'
import {
  buildCastCardModel,
  buildClipPrepHash,
  clipStillStatus,
  collectTimelineCharacterIds,
  parseEntryStillPromptCache,
  parseStoryCastPrep,
  resolveCastRefFromPrep,
  serializeEntryStillPromptCache,
  serializeStoryCastPrep,
  type AdvancedCastCardModel,
  type EntryStillPromptCache,
  type StoryCastPrep
} from '../../domain/advancedPrep'
import { parseIdList } from '../../domain/timelineBindings'
import { sortTimelineEntries } from '../../domain/timeline'
import { getPreviousTimelineEntry } from '../../domain/promptContinuity'
import { snapVideoSeconds } from '../../domain/videoDuration'
import { AppError } from '../../types/errors'

export interface AdvancedPrepSnapshot {
  storyId: string
  storyTitle: string
  castPrep: StoryCastPrep
  castCards: AdvancedCastCardModel[]
  cells: Array<{
    entryId: string
    order: number
    displayIndex: number
    startTime: number
    endTime: number
    dialogue: string | null
    beatSnippet: string
    stillPath: string
    stillStatus: 'missing' | 'ready' | 'stale'
    mediaStatus: string
    continuityKind: 'first' | 'locked' | 'text-only'
    characterIds: string[]
    characterNames: string[]
    hasCachedPrompt: boolean
    professionalPrompt: string | null
    durationSeconds: number
    mediaPath: string | null
    /** Still was healed from existing clip video on this load */
    stillFromVideo?: boolean
  }>
  summary: {
    castReady: number
    castTotal: number
    stillReady: number
    stillTotal: number
    videoReady: number
  }
}

type ImageAi = {
  generateImage(options: {
    prompt: string
    size?: string
    aspectRatio?: string
  }): Promise<{ b64: string }>
  editImage(options: {
    prompt: string
    imagePath: string
    size?: string
    aspectRatio?: string
  }): Promise<{ b64: string }>
  chat?(messages: Array<{ role: string; content: string }>): Promise<string>
}

export class AdvancedPrepService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly store: MediaStore,
    /** Reserved for still image generation; wired by registerAllHandlers. */
    getAi: () => ImageAi,
    private readonly getSettings: () => {
      aspectRatio?: string
      imageSizeTall?: string
      imageSizeWide?: string
      imageSizeSquare?: string
      uiLanguage?: string
    },
    private readonly ffmpeg: FfmpegService = new FfmpegService()
  ) {
    void getAi
  }

  private asList(
    multi: string | string[] | null | undefined,
    primary: string | null
  ): string[] {
    if (Array.isArray(multi) && multi.length > 0) {
      return multi.filter((x) => typeof x === 'string' && x.trim())
    }
    if (typeof multi === 'string') return parseIdList(multi, primary)
    return parseIdList(null, primary)
  }

  loadCastPrep(storyId: string): StoryCastPrep {
    return parseStoryCastPrep(this.store.readStoryCastPrepJson(storyId))
  }

  saveCastPrep(storyId: string, prep: StoryCastPrep): StoryCastPrep {
    const normalized = parseStoryCastPrep(serializeStoryCastPrep(prep))
    this.store.writeStoryCastPrepJson(
      storyId,
      serializeStoryCastPrep(normalized)
    )
    return normalized
  }

  loadStillCache(
    storyId: string,
    entryId: string
  ): EntryStillPromptCache | null {
    return parseEntryStillPromptCache(
      this.store.readEntryStillPromptJson(storyId, entryId)
    )
  }

  saveStillCache(
    storyId: string,
    entryId: string,
    cache: EntryStillPromptCache
  ): void {
    this.store.writeEntryStillPromptJson(
      storyId,
      entryId,
      serializeEntryStillPromptCache(cache)
    )
  }

  async getSnapshot(storyId: string): Promise<AdvancedPrepSnapshot> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      include: {
        timeline: true,
        storyCharacters: { include: { character: true } }
      }
    })
    if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))

    const timeline = sortTimelineEntries(
      story.timeline as unknown as TimelineEntry[]
    )
    const castPrep = this.loadCastPrep(storyId)

    // Characters: story-linked ∪ timeline-used
    const charById = new Map<string, Character>()
    for (const sc of story.storyCharacters || []) {
      const c = (sc as { character?: Character }).character
      if (c) charById.set(c.id, c as Character)
    }
    // hydrate timeline-only ids
    const usedIds = collectTimelineCharacterIds(timeline)
    for (const id of usedIds) {
      if (!charById.has(id)) {
        const row = await this.prisma.character.findUnique({ where: { id } })
        if (row) charById.set(id, row as unknown as Character)
      }
    }
    const castIds =
      usedIds.length > 0 ? usedIds : [...charById.keys()].slice(0, 24)
    const castCards = castIds
      .map((id) => {
        const ch = charById.get(id)
        if (!ch) return null
        return buildCastCardModel(ch, castPrep.characters[id])
      })
      .filter(Boolean) as AdvancedCastCardModel[]

    // Heal: if clip video exists but continuity still missing, extract a frame.
    // Skip when user explicitly removed the still (marker file).
    for (const e of timeline) {
      const stillPath = this.store.clipContinuityStillPath(storyId, e.id)
      const mediaPath = e.mediaPath?.trim() || null
      if (this.store.isEntryStillUserCleared(storyId, e.id)) {
        continue
      }
      if (
        !existsSync(stillPath) &&
        mediaPath &&
        existsSync(mediaPath) &&
        (e.mediaStatus === 'READY' || mediaPath.endsWith('.mp4'))
      ) {
        try {
          this.store.ensureStoryDirs(storyId)
          // End frame so next beat locks to previous shot's end state (not open).
          await this.ffmpeg.extractStillFrame({
            videoPath: mediaPath,
            outputPath: stillPath,
            atSeconds: 'end'
          })
        } catch {
          /* best-effort — leave missing */
        }
      }
    }

    const cells = timeline.map((e, idx) => {
      const charIds = this.asList(
        (e as { characterIds?: string | string[] | null }).characterIds,
        e.characterId
      )
      const sceneIds = this.asList(
        (e as { sceneIds?: string | string[] | null }).sceneIds,
        e.sceneId
      )
      const propIds = this.asList(
        (e as { propIds?: string | string[] | null }).propIds,
        e.propId
      )
      const castRef = resolveCastRefFromPrep(charIds[0] ?? null, castPrep)
      const seconds = snapVideoSeconds(e.endTime - e.startTime)
      const hash = buildClipPrepHash({
        entryId: e.id,
        dialogue: e.dialogue,
        beatContentJson: (e as { beatContentJson?: string | null })
          .beatContentJson,
        characterIds: charIds,
        sceneIds,
        propIds,
        castRefPath: castRef,
        styleNote: (story as { styleNote?: string | null }).styleNote,
        seconds
      })
      const stillPath = this.store.clipContinuityStillPath(storyId, e.id)
      const cache = this.loadStillCache(storyId, e.id)
      const stillFileExists = existsSync(stillPath)
      const stillStatus = clipStillStatus({
        stillFileExists,
        cache,
        currentHash: hash
      })
      const prev = getPreviousTimelineEntry(timeline, e.id)
      let continuityKind: 'first' | 'locked' | 'text-only' = 'first'
      if (prev) {
        const prevStill = this.store.clipContinuityStillPath(storyId, prev.id)
        continuityKind = existsSync(prevStill) ? 'locked' : 'text-only'
      }
      const names = charIds
        .map((id) => charById.get(id)?.name)
        .filter(Boolean) as string[]
      const beatSnippet = (e.dialogue || '').slice(0, 120)
      const mediaPath = e.mediaPath?.trim() || null
      return {
        entryId: e.id,
        order: e.order,
        displayIndex: idx + 1,
        startTime: e.startTime,
        endTime: e.endTime,
        dialogue: e.dialogue,
        beatSnippet,
        stillPath,
        stillStatus,
        mediaStatus: e.mediaStatus,
        continuityKind,
        characterIds: charIds,
        characterNames: names,
        hasCachedPrompt: Boolean(cache?.professionalPrompt),
        professionalPrompt: cache?.professionalPrompt ?? null,
        durationSeconds: seconds,
        mediaPath,
        stillFromVideo: stillFileExists && !cache
      }
    })

    const castReady = castCards.filter((c) => c.hasAnyImage).length
    const stillReady = cells.filter((c) => c.stillStatus === 'ready').length
    const videoReady = cells.filter((c) => c.mediaStatus === 'READY').length

    return {
      storyId,
      storyTitle: story.title,
      castPrep,
      castCards,
      cells,
      summary: {
        castReady,
        castTotal: castCards.length,
        stillReady,
        stillTotal: cells.length,
        videoReady
      }
    }
  }

  /** Delete continuity still + prompt cache so user can re-gen. */
  clearEntryStill(storyId: string, entryId: string): {
    ok: true
    stillPath: string
  } {
    const stillPath = this.store.clipContinuityStillPath(storyId, entryId)
    const promptPath = this.store.entryStillPromptPath(storyId, entryId)
    for (const p of [stillPath, promptPath]) {
      try {
        if (existsSync(p)) unlinkSync(p)
      } catch {
        /* ignore */
      }
    }
    // Prevent auto re-extract from existing video on next snapshot load
    this.store.markEntryStillUserCleared(storyId, entryId)
    return { ok: true, stillPath }
  }

  /** Call before AI still gen so heal marker does not block new still. */
  prepareForStillRegen(storyId: string, entryId: string): void {
    this.store.clearEntryStillUserCleared(storyId, entryId)
  }

  /**
   * Build a video-prep draft from existing still (skip image gen).
   * Re-polishes prompt if cache missing or forcePolish.
   */
  async openFromStill(options: {
    storyId: string
    entryId: string
    locale?: 'zh-HK' | 'en'
    forcePolish?: boolean
  }): Promise<{
    kind: 'timeline-clip'
    entityIds: { storyId: string; entryId: string }
    professionalPrompt: string
    userExtraPrompt: string
    stillPath: string
    sourceImagePath: string | null
    durationSeconds: number
    aspectRatio: string
    materialsSummary?: string
    polished?: boolean
    skippedStill: true
  }> {
    const snap = await this.getSnapshot(options.storyId)
    const cell = snap.cells.find((c) => c.entryId === options.entryId)
    if (!cell) throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound')
    if (!existsSync(cell.stillPath)) {
      throw new AppError('VALIDATION', 'errors.sourceImageRequired')
    }
    const settings = this.getSettings()
    const aspectRatio =
      settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
        ? settings.aspectRatio
        : '16:9'
    const cache = this.loadStillCache(options.storyId, options.entryId)
    let professionalPrompt = cache?.professionalPrompt?.trim() || ''
    let materialsSummary = cache?.materialsSummary
    let polished = false
    let sourceImagePath = cache?.sourceImagePath ?? null

    if (!professionalPrompt || options.forcePolish || cell.stillStatus === 'stale') {
      // Lightweight: reuse create path would be heavy; build minimal polish via create flags
      // Caller may fall back to videoPrep:create with skipStillIfExists
      professionalPrompt =
        professionalPrompt ||
        `Short drama clip keyframe still for beat #${cell.displayIndex}. ${cell.beatSnippet || ''}`.trim()
      materialsSummary =
        materialsSummary ||
        `still: reuse ${cell.stillPath}\ncontinuity: ${cell.continuityKind}`
      polished = false
    }

    return {
      kind: 'timeline-clip',
      entityIds: { storyId: options.storyId, entryId: options.entryId },
      professionalPrompt,
      userExtraPrompt: cache?.userExtraPrompt || '',
      stillPath: cell.stillPath,
      sourceImagePath,
      durationSeconds: cell.durationSeconds,
      aspectRatio,
      materialsSummary,
      polished,
      skippedStill: true
    }
  }
}
