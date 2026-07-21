import type { PrismaClient } from '../../types/prisma'
import type {
  CreateTimelineEntryInput,
  TimelineEntry,
  UpdateTimelineEntryInput
} from '../../types/domain'
import { AppError } from '../../types/errors'
import {
  DEFAULT_MAX_CLIP_SECONDS,
  clampDuration,
  reindexOrders,
  validateTimeRange
} from '../../domain/timeline'
import {
  hydrateTimelineBindings,
  normalizeBindings
} from '../../domain/timelineBindings'
import { StoryCastService } from './StoryCastService'

export class TimelinePersistenceService {
  constructor(private readonly prisma: PrismaClient) {}

  private cast(): StoryCastService {
    return new StoryCastService(this.prisma)
  }

  private mapRow(row: {
    id: string
    storyId: string
    startTime: number
    endTime: number
    characterId: string | null
    sceneId: string | null
    propId: string | null
    actionId?: string | null
    characterIds?: string | null
    sceneIds?: string | null
    propIds?: string | null
    actionIds?: string | null
    dialogue: string | null
    beatContentJson?: string | null
    order: number
    mediaPath: string | null
    mediaStatus: TimelineEntry['mediaStatus']
    mediaError: string | null
    videoJobId: string | null
  }): TimelineEntry {
    const h = hydrateTimelineBindings(row)
    return {
      id: h.id,
      storyId: h.storyId,
      startTime: h.startTime,
      endTime: h.endTime,
      characterId: h.characterId,
      sceneId: h.sceneId,
      propId: h.propId,
      actionId: h.actionId ?? null,
      characterIds: h.characterIds,
      sceneIds: h.sceneIds,
      propIds: h.propIds,
      actionIds: h.actionIds,
      dialogue: h.dialogue,
      beatContentJson:
        (row as { beatContentJson?: string | null }).beatContentJson ?? null,
      order: h.order,
      mediaPath: h.mediaPath,
      mediaStatus: h.mediaStatus,
      mediaError: h.mediaError,
      videoJobId: h.videoJobId
    }
  }

  async list(storyId: string): Promise<TimelineEntry[]> {
    const rows = await this.prisma.timelineEntry.findMany({
      where: { storyId },
      orderBy: [{ startTime: 'asc' }, { order: 'asc' }]
    })
    // Background: keep order field aligned with startTime (no manual Reorder button)
    const didSync = await this.syncOrderByStartTime(storyId, rows)
    if (!didSync) {
      return rows.map((r) => this.mapRow(r as Parameters<typeof this.mapRow>[0]))
    }
    const sorted = await this.prisma.timelineEntry.findMany({
      where: { storyId },
      orderBy: [{ startTime: 'asc' }, { order: 'asc' }]
    })
    return sorted.map((r) => this.mapRow(r as Parameters<typeof this.mapRow>[0]))
  }

  /**
   * Silently reindex `order` 0..n-1 by startTime when out of sync.
   * No-op when already consistent (avoids write churn on every list).
   */
  /** @returns true if any order rows were rewritten */
  private async syncOrderByStartTime(
    storyId: string,
    rows?: Array<{ id: string; startTime: number; order: number }>
  ): Promise<boolean> {
    const list =
      rows ??
      (await this.prisma.timelineEntry.findMany({
        where: { storyId },
        select: { id: true, startTime: true, order: true }
      }))
    if (list.length === 0) return false
    const byStart = [...list].sort(
      (a, b) => a.startTime - b.startTime || a.order - b.order
    )
    const needs = byStart.some((r, i) => r.order !== i)
    if (!needs) return false
    await this.prisma.$transaction(
      byStart.map((r, i) =>
        this.prisma.timelineEntry.update({
          where: { id: r.id },
          data: { order: i }
        })
      )
    )
    return true
  }

  async create(input: CreateTimelineEntryInput): Promise<TimelineEntry> {
    await this.ensureStory(input.storyId)
    const rangeErr = validateTimeRange(
      input.startTime,
      input.endTime,
      DEFAULT_MAX_CLIP_SECONDS
    )
    if (rangeErr) throw new AppError('VALIDATION', rangeErr)

    const binds = normalizeBindings({
      characterId: input.characterId,
      sceneId: input.sceneId,
      propId: input.propId,
      actionId: input.actionId,
      characterIds: input.characterIds,
      sceneIds: input.sceneIds,
      propIds: input.propIds,
      actionIds: input.actionIds
    })

    await this.cast().assertCastMember(input.storyId, {
      characterIds: binds.characterIdList,
      sceneIds: binds.sceneIdList,
      propIds: binds.propIdList,
      actionIds: binds.actionIdList
    })

    const row = await this.prisma.timelineEntry.create({
      data: {
        storyId: input.storyId,
        startTime: input.startTime,
        endTime: input.endTime,
        characterId: binds.characterId,
        sceneId: binds.sceneId,
        propId: binds.propId,
        actionId: binds.actionId,
        characterIds: binds.characterIds,
        sceneIds: binds.sceneIds,
        propIds: binds.propIds,
        actionIds: binds.actionIds,
        dialogue: input.dialogue ?? null,
        beatContentJson: input.beatContentJson ?? null,
        order: input.order
      }
    })
    await this.syncOrderByStartTime(input.storyId)
    const fresh = await this.prisma.timelineEntry.findUnique({ where: { id: row.id } })
    return this.mapRow((fresh ?? row) as Parameters<typeof this.mapRow>[0])
  }

  async update(id: string, data: UpdateTimelineEntryInput): Promise<TimelineEntry> {
    const existing = await this.prisma.timelineEntry.findUnique({ where: { id } })
    if (!existing) throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound', String(id))

    const touchTimes =
      data.startTime !== undefined || data.endTime !== undefined
    let startTime = data.startTime ?? existing.startTime
    let endTime = data.endTime ?? existing.endTime

    if (touchTimes) {
      const rangeErr = validateTimeRange(
        startTime,
        endTime,
        DEFAULT_MAX_CLIP_SECONDS
      )
      if (rangeErr) throw new AppError('VALIDATION', rangeErr)
    } else {
      // Bindings / dialogue-only updates must not fail on legacy overlong clips
      // (e.g. AI script created 20s+ beats). Heal duration so multi-select works.
      const rangeErr = validateTimeRange(
        startTime,
        endTime,
        DEFAULT_MAX_CLIP_SECONDS
      )
      if (rangeErr) {
        const healed = clampDuration(
          startTime,
          endTime,
          DEFAULT_MAX_CLIP_SECONDS
        )
        startTime = healed.startTime
        endTime = healed.endTime
        data = { ...data, startTime, endTime }
      }
    }

    const binds = normalizeBindings({
      characterId: data.characterId,
      sceneId: data.sceneId,
      propId: data.propId,
      actionId: data.actionId,
      characterIds: data.characterIds,
      sceneIds: data.sceneIds,
      propIds: data.propIds,
      actionIds: data.actionIds,
      existing: {
        characterId: existing.characterId,
        sceneId: existing.sceneId,
        propId: existing.propId,
        actionId: (existing as { actionId?: string | null }).actionId,
        characterIds: (existing as { characterIds?: string | null }).characterIds,
        sceneIds: (existing as { sceneIds?: string | null }).sceneIds,
        propIds: (existing as { propIds?: string | null }).propIds,
        actionIds: (existing as { actionIds?: string | null }).actionIds
      }
    })

    const touchBinds =
      data.characterId !== undefined ||
      data.sceneId !== undefined ||
      data.propId !== undefined ||
      data.actionId !== undefined ||
      data.characterIds !== undefined ||
      data.sceneIds !== undefined ||
      data.propIds !== undefined ||
      data.actionIds !== undefined

    if (touchBinds) {
      await this.cast().assertCastMember(existing.storyId, {
        characterIds: binds.characterIdList,
        sceneIds: binds.sceneIdList,
        propIds: binds.propIdList,
        actionIds: binds.actionIdList
      })
    }

    const writeStart =
      data.startTime !== undefined ? data.startTime : undefined
    const writeEnd = data.endTime !== undefined ? data.endTime : undefined

    const row = await this.prisma.timelineEntry.update({
      where: { id },
      data: {
        ...(writeStart !== undefined ? { startTime: writeStart } : {}),
        ...(writeEnd !== undefined ? { endTime: writeEnd } : {}),
        ...(touchBinds
          ? {
              characterId: binds.characterId,
              sceneId: binds.sceneId,
              propId: binds.propId,
              actionId: binds.actionId,
              characterIds: binds.characterIds,
              sceneIds: binds.sceneIds,
              propIds: binds.propIds,
              actionIds: binds.actionIds
            }
          : {}),
        ...(data.dialogue !== undefined ? { dialogue: data.dialogue } : {}),
        ...(data.beatContentJson !== undefined
          ? { beatContentJson: data.beatContentJson }
          : {}),
        ...(data.order !== undefined ? { order: data.order } : {}),
        ...(data.mediaPath !== undefined ? { mediaPath: data.mediaPath } : {}),
        ...(data.mediaStatus !== undefined ? { mediaStatus: data.mediaStatus } : {}),
        ...(data.mediaError !== undefined ? { mediaError: data.mediaError } : {}),
        ...(data.videoJobId !== undefined ? { videoJobId: data.videoJobId } : {})
      }
    })
    if (writeStart !== undefined || writeEnd !== undefined) {
      await this.syncOrderByStartTime(existing.storyId)
      const fresh = await this.prisma.timelineEntry.findUnique({ where: { id } })
      if (fresh) return this.mapRow(fresh as Parameters<typeof this.mapRow>[0])
    }
    return this.mapRow(row as Parameters<typeof this.mapRow>[0])
  }

  async setMedia(
    id: string,
    data: {
      mediaPath?: string | null
      mediaStatus: 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
      mediaError?: string | null
      videoJobId?: string | null
    }
  ) {
    await this.ensureExists(id)
    const row = await this.prisma.timelineEntry.update({
      where: { id },
      data: {
        mediaPath: data.mediaPath === undefined ? undefined : data.mediaPath,
        mediaStatus: data.mediaStatus,
        mediaError: data.mediaError ?? null,
        videoJobId: data.videoJobId === undefined ? undefined : data.videoJobId
      }
    })
    return this.mapRow(row as Parameters<typeof this.mapRow>[0])
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.timelineEntry.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound', String(id))
  }

  async delete(id: string) {
    const existing = await this.prisma.timelineEntry.findUnique({
      where: { id },
      select: { id: true, storyId: true }
    })
    if (!existing) throw new AppError('NOT_FOUND', 'errors.timelineEntryNotFound', String(id))
    await this.prisma.timelineEntry.delete({ where: { id } })
    await this.syncOrderByStartTime(existing.storyId)
    return { ok: true as const }
  }

  async reorder(storyId: string, orderedIds: string[]) {
    await this.ensureStory(storyId)
    const indexMap = reindexOrders(orderedIds)
    await this.prisma.$transaction(
      orderedIds.map((id) =>
        this.prisma.timelineEntry.update({
          where: { id },
          data: { order: indexMap.get(id) ?? 0 }
        })
      )
    )
    // Prefer startTime as source of truth after any manual reorder payload
    await this.syncOrderByStartTime(storyId)
    return this.list(storyId)
  }

  private async ensureStory(storyId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true }
    })
    if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(storyId))
  }
}
