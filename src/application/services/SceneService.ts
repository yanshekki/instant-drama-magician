import type { PrismaClient } from '../../types/prisma'
import type { CreateSceneInput, SceneStatus } from '../../types/domain'
import { AppError } from '../../types/errors'
import {
  isSceneStatus,
  validateSceneDescription,
  validateSceneNumber
} from '../../domain/scene'

export class SceneService {
  constructor(private readonly prisma: PrismaClient) {}

  list(storyId: string) {
    return this.prisma.scene.findMany({
      where: { storyId },
      orderBy: { sceneNumber: 'asc' }
    })
  }

  async create(input: CreateSceneInput) {
    await this.ensureStory(input.storyId)
    const numErr = validateSceneNumber(input.sceneNumber)
    if (numErr) throw new AppError('VALIDATION', numErr)
    const descErr = validateSceneDescription(input.description)
    if (descErr) throw new AppError('VALIDATION', descErr)
    if (input.status !== undefined && !isSceneStatus(input.status)) {
      throw new AppError('VALIDATION', `Invalid scene status: ${input.status}`)
    }
    return this.prisma.scene.create({
      data: {
        storyId: input.storyId,
        sceneNumber: input.sceneNumber,
        description: input.description.trim(),
        script: input.script ?? null,
        status: input.status ?? 'PENDING'
      }
    })
  }

  async update(
    id: string,
    data: Partial<
      Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script' | 'status'>
    >
  ) {
    await this.ensureExists(id)
    if (data.sceneNumber !== undefined) {
      const numErr = validateSceneNumber(data.sceneNumber)
      if (numErr) throw new AppError('VALIDATION', numErr)
    }
    if (data.description !== undefined) {
      const descErr = validateSceneDescription(data.description)
      if (descErr) throw new AppError('VALIDATION', descErr)
    }
    if (data.status !== undefined && !isSceneStatus(data.status)) {
      throw new AppError('VALIDATION', `Invalid scene status: ${data.status}`)
    }
    return this.prisma.scene.update({
      where: { id },
      data: {
        ...(data.sceneNumber !== undefined ? { sceneNumber: data.sceneNumber } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.script !== undefined ? { script: data.script } : {}),
        ...(data.status !== undefined ? { status: data.status as SceneStatus } : {})
      }
    })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.scene.delete({ where: { id } })
    return { ok: true as const }
  }

  private async ensureStory(storyId: string): Promise<void> {
    const story = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.scene.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', `Scene not found: ${id}`)
  }
}
