import type { PrismaClient, StoryStatus } from '../../types/prisma'
import type { CreateStoryInput, UpdateStoryInput } from '../../types/domain'
import { AppError } from '../../types/errors'
import { isStoryStatus, normalizeStoryTitle, validateStoryTitle } from '../../domain/story'

export class StoryService {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.story.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: {
            storyCharacters: true,
            storyScenes: true,
            storyProps: true,
            storyActions: true,
            timeline: true
          }
        }
      }
    })
  }

  async get(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: {
        storyCharacters: {
          orderBy: { sortOrder: 'asc' },
          include: {
            character: true,
            costume: true
          }
        },
        storyScenes: {
          orderBy: { sceneNumber: 'asc' },
          include: { scene: true }
        },
        storyProps: {
          orderBy: { sortOrder: 'asc' },
          include: { prop: true }
        },
        storyActions: {
          orderBy: { sortOrder: 'asc' },
          include: { action: true }
        },
        timeline: { orderBy: { order: 'asc' } }
      }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${id}`)
    // Flatten for consumers expecting characters/scenes/props/actions arrays
    return {
      ...story,
      characters: story.storyCharacters.map((l) => ({
        ...l.character,
        /** Story-level wardrobe pick (null = character default costume text). */
        storyCostumeId: l.costumeId,
        storyCostume: l.costume
          ? {
              id: l.costume.id,
              name: l.costume.name,
              description: l.costume.description,
              refImagePath: l.costume.refImagePath
            }
          : null
      })),
      scenes: story.storyScenes.map((l) => ({
        ...l.scene,
        sceneNumber: l.sceneNumber,
        script: l.scriptOverride ?? l.scene.script,
        status: l.statusOverride ?? l.scene.status
      })),
      props: story.storyProps.map((l) => l.prop),
      actions: story.storyActions.map((l) => l.action),
      _count: {
        characters: story.storyCharacters.length,
        scenes: story.storyScenes.length,
        props: story.storyProps.length,
        actions: story.storyActions.length,
        timeline: story.timeline.length
      }
    }
  }

  create(input: CreateStoryInput) {
    const title = normalizeStoryTitle(input.title)
    const err = validateStoryTitle(title)
    if (err) throw new AppError('VALIDATION', err)
    return this.prisma.story.create({
      data: {
        title,
        styleNote: input.styleNote?.trim() || null,
        artStyle: input.artStyle?.trim() || null
      }
    })
  }

  async update(id: string, data: UpdateStoryInput) {
    await this.ensureExists(id)
    const patch: {
      title?: string
      status?: StoryStatus
      styleNote?: string | null
      artStyle?: string | null
      coverPath?: string | null
      refGalleryJson?: string | null
    } = {}
    if (data.title !== undefined) {
      const title = normalizeStoryTitle(data.title)
      const err = validateStoryTitle(title)
      if (err) throw new AppError('VALIDATION', err)
      patch.title = title
    }
    if (data.status !== undefined) {
      if (!isStoryStatus(data.status)) {
        throw new AppError('VALIDATION', `Invalid story status: ${data.status}`)
      }
      patch.status = data.status
    }
    if (data.styleNote !== undefined) {
      patch.styleNote = data.styleNote?.trim() || null
    }
    if (data.artStyle !== undefined) {
      patch.artStyle = data.artStyle?.trim() || null
    }
    if (data.coverPath !== undefined) {
      patch.coverPath = data.coverPath?.trim() || null
    }
    if (data.refGalleryJson !== undefined) {
      patch.refGalleryJson = data.refGalleryJson?.trim() || null
    }
    return this.prisma.story.update({ where: { id }, data: patch })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.story.delete({ where: { id } })
    return { ok: true as const }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.story.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', `Story not found: ${id}`)
  }
}
