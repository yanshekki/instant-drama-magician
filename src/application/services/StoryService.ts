import type { PrismaClient, StoryStatus } from '../../types/prisma'
import type { CreateStoryInput } from '../../types/domain'
import { AppError } from '../../types/errors'
import { isStoryStatus, normalizeStoryTitle, validateStoryTitle } from '../../domain/story'

export class StoryService {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.story.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { characters: true, scenes: true, props: true, timeline: true }
        }
      }
    })
  }

  async get(id: string) {
    const story = await this.prisma.story.findUnique({
      where: { id },
      include: {
        characters: true,
        scenes: { orderBy: { sceneNumber: 'asc' } },
        props: true,
        timeline: { orderBy: { order: 'asc' } }
      }
    })
    if (!story) throw new AppError('NOT_FOUND', `Story not found: ${id}`)
    return story
  }

  create(input: CreateStoryInput) {
    const title = normalizeStoryTitle(input.title)
    const err = validateStoryTitle(title)
    if (err) throw new AppError('VALIDATION', err)
    return this.prisma.story.create({ data: { title } })
  }

  async update(id: string, data: { title?: string; status?: StoryStatus | string }) {
    await this.ensureExists(id)
    const patch: { title?: string; status?: StoryStatus } = {}
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
    return this.prisma.story.update({ where: { id }, data: patch })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.story.delete({ where: { id } })
    return { ok: true as const }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.story.findUnique({ where: { id }, select: { id: true } })
    if (!found) throw new AppError('NOT_FOUND', `Story not found: ${id}`)
  }
}
