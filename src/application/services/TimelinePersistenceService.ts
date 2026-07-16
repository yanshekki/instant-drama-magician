import type { PrismaClient } from '../../types/prisma'
import type {
  CreateTimelineEntryInput,
  UpdateTimelineEntryInput
} from '../../types/domain'
import { AppError } from '../../types/errors'
import {
  DEFAULT_MAX_CLIP_SECONDS,
  reindexOrders,
  validateTimeRange
} from '../../domain/timeline'

export class TimelinePersistenceService {
  constructor(private readonly prisma: PrismaClient) {}

  list(storyId: string) {
    return this.prisma.timelineEntry.findMany({
      where: { storyId },
      orderBy: { order: 'asc' }
    })
  }

  async create(input: CreateTimelineEntryInput) {
    await this.ensureStory(input.storyId)
    const rangeErr = validateTimeRange(
      input.startTime,
      input.endTime,
      DEFAULT_MAX_CLIP_SECONDS
    )
    if (rangeErr) throw new AppError('VALIDATION', rangeErr)
    return this.prisma.timelineEntry.create({
      data: {
        storyId: input.storyId,
        startTime: input.startTime,
        endTime: input.endTime,
        characterId: input.characterId ?? null,
        sceneId: input.sceneId ?? null,
        propId: input.propId ?? null,
        dialogue: input.dialogue ?? null,
        order: input.order
      }
    })
  }

  async update(id: string, data: UpdateTimelineEntryInput) {
    const existing = await this.prisma.timelineEntry.findUnique({ where: { id } })
    if (!existing) throw new AppError('NOT_FOUND', `Timeline entry not found: ${id}`)

    const startTime = data.startTime ?? existing.startTime
    const endTime = data.endTime ?? existing.endTime
    const rangeErr = validateTimeRange(startTime, endTime, DEFAULT_MAX_CLIP_SECONDS)
    if (rangeErr) throw new AppError('VALIDATION', rangeErr)

    return this.prisma.timelineEntry.update({
      where: { id },
      data: {
        ...(data.startTime !== undefined ? { startTime: data.startTime } : {}),
        ...(data.endTime !== undefined ? { endTime: data.endTime } : {}),
        ...(data.characterId !== undefined ? { characterId: data.characterId } : {}),
        ...(data.sceneId !== undefined ? { sceneId: data.sceneId } : {}),
        ...(data.propId !== undefined ? { propId: data.propId } : {}),
        ...(data.dialogue !== undefined ? { dialogue: data.dialogue } : {}),
        ...(data.order !== undefined ? { order: data.order } : {})
      }
    })
  }

  async delete(id: string) {
    const existing = await this.prisma.timelineEntry.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!existing) throw new AppError('NOT_FOUND', `Timeline entry not found: ${id}`)
    await this.prisma.timelineEntry.delete({ where: { id } })
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
    return this.list(storyId)
  }

  private async ensureStory(storyId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
  }
}
