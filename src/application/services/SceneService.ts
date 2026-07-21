import type { PrismaClient } from '../../types/prisma'
import type {
  CreateSceneInput,
  SceneStatus,
  UpdateSceneInput
} from '../../types/domain'
import { AppError } from '../../types/errors'
import {
  isSceneStatus,
  validateSceneDescription
} from '../../domain/scene'
import { StoryCastService } from './StoryCastService'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

export class SceneService {
  constructor(private readonly prisma: PrismaClient) {}

  list(opts?: { q?: string }) {
    const q = opts?.q?.trim()
    return this.prisma.scene.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q } },
              { description: { contains: q } }
            ]
          }
        : undefined,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    })
  }

  listForStory(storyId: string) {
    return new StoryCastService(this.prisma).listScenesForStory(storyId)
  }

  async get(id: string) {
    const row = await this.prisma.scene.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', 'errors.sceneNotFound', String(id))
    return row
  }

  async create(input: CreateSceneInput & { linkStoryId?: string | null }) {
    const descErr = validateSceneDescription(input.description)
    if (descErr) throw new AppError('VALIDATION', descErr)
    if (input.status !== undefined && !isSceneStatus(input.status)) {
      throw new AppError('VALIDATION', 'errors.invalidSceneStatus', String(input.status))
    }
    const row = await this.prisma.scene.create({
      data: {
        description: input.description.trim(),
        script: trimOrNull(input.script),
        status: input.status ?? 'PENDING',
        title: trimOrNull(input.title),
        locationType: trimOrNull(input.locationType),
        timeOfDay: trimOrNull(input.timeOfDay),
        weather: trimOrNull(input.weather),
        mood: trimOrNull(input.mood),
        lighting: trimOrNull(input.lighting),
        colorPalette: trimOrNull(input.colorPalette),
        setDressing: trimOrNull(input.setDressing),
        soundscape: trimOrNull(input.soundscape),
        cameraNotes: trimOrNull(input.cameraNotes),
        visualTags: trimOrNull(input.visualTags),
        artStyle: trimOrNull(input.artStyle),
        refImagePath: trimOrNull(input.refImagePath),
        refGalleryJson: trimOrNull(input.refGalleryJson),
        looksJson: trimOrNull(input.looksJson),
        profileJson: trimOrNull(input.profileJson),
        seedPrompt: trimOrNull(input.seedPrompt),
        hardRules: trimOrNull(input.hardRules),
        locationKey: trimOrNull(input.locationKey)
      }
    })
    const linkStoryId = input.linkStoryId ?? input.storyId
    if (linkStoryId) {
      const n =
        typeof input.sceneNumber === 'number' &&
        Number.isFinite(input.sceneNumber) &&
        Number.isInteger(input.sceneNumber) &&
        input.sceneNumber >= 1
          ? input.sceneNumber
          : undefined
      await new StoryCastService(this.prisma).linkScene(linkStoryId, row.id, {
        sceneNumber: n
      })
    }
    return row
  }

  async update(id: string, data: UpdateSceneInput) {
    await this.ensureExists(id)
    if (data.description !== undefined) {
      const descErr = validateSceneDescription(data.description)
      if (descErr) throw new AppError('VALIDATION', descErr)
    }
    if (data.status !== undefined && !isSceneStatus(data.status)) {
      throw new AppError('VALIDATION', 'errors.invalidSceneStatus', String(data.status))
    }
    return this.prisma.scene.update({
      where: { id },
      data: {
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.script !== undefined
          ? { script: trimOrNull(data.script) }
          : {}),
        ...(data.status !== undefined
          ? { status: data.status as SceneStatus }
          : {}),
        ...(data.title !== undefined ? { title: trimOrNull(data.title) } : {}),
        ...(data.locationType !== undefined
          ? { locationType: trimOrNull(data.locationType) }
          : {}),
        ...(data.timeOfDay !== undefined
          ? { timeOfDay: trimOrNull(data.timeOfDay) }
          : {}),
        ...(data.weather !== undefined
          ? { weather: trimOrNull(data.weather) }
          : {}),
        ...(data.mood !== undefined ? { mood: trimOrNull(data.mood) } : {}),
        ...(data.lighting !== undefined
          ? { lighting: trimOrNull(data.lighting) }
          : {}),
        ...(data.colorPalette !== undefined
          ? { colorPalette: trimOrNull(data.colorPalette) }
          : {}),
        ...(data.setDressing !== undefined
          ? { setDressing: trimOrNull(data.setDressing) }
          : {}),
        ...(data.soundscape !== undefined
          ? { soundscape: trimOrNull(data.soundscape) }
          : {}),
        ...(data.cameraNotes !== undefined
          ? { cameraNotes: trimOrNull(data.cameraNotes) }
          : {}),
        ...(data.visualTags !== undefined
          ? { visualTags: trimOrNull(data.visualTags) }
          : {}),
        ...(data.artStyle !== undefined
          ? { artStyle: trimOrNull(data.artStyle) }
          : {}),
        ...(data.refImagePath !== undefined
          ? { refImagePath: trimOrNull(data.refImagePath) }
          : {}),
        ...(data.refGalleryJson !== undefined
          ? { refGalleryJson: trimOrNull(data.refGalleryJson) }
          : {}),
        ...(data.looksJson !== undefined
          ? { looksJson: trimOrNull(data.looksJson) }
          : {}),
        ...(data.profileJson !== undefined
          ? { profileJson: trimOrNull(data.profileJson) }
          : {}),
        ...(data.seedPrompt !== undefined
          ? { seedPrompt: trimOrNull(data.seedPrompt) }
          : {}),
        ...(data.hardRules !== undefined
          ? { hardRules: trimOrNull(data.hardRules) }
          : {}),
        ...(data.locationKey !== undefined
          ? { locationKey: trimOrNull(data.locationKey) }
          : {})
      }
    })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.scene.delete({ where: { id } })
    return { ok: true as const }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.scene.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', 'errors.sceneNotFound', String(id))
  }
}
