import type { PrismaClient } from '../../types/prisma'
import type { CreatePropInput } from '../../types/domain'
import { AppError } from '../../types/errors'

export class PropService {
  constructor(private readonly prisma: PrismaClient) {}

  list(storyId: string) {
    return this.prisma.prop.findMany({
      where: { storyId },
      orderBy: { name: 'asc' }
    })
  }

  async create(input: CreatePropInput) {
    await this.ensureStory(input.storyId)
    if (!input.name.trim()) throw new AppError('VALIDATION', 'name is required')
    return this.prisma.prop.create({
      data: {
        storyId: input.storyId,
        name: input.name.trim(),
        description: input.description.trim()
      }
    })
  }

  async update(
    id: string,
    data: Partial<Pick<CreatePropInput, 'name' | 'description'>>
  ) {
    await this.ensureExists(id)
    if (data.name !== undefined && !data.name.trim()) {
      throw new AppError('VALIDATION', 'name is required')
    }
    return this.prisma.prop.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {})
      }
    })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.prop.delete({ where: { id } })
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
    const found = await this.prisma.prop.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', `Prop not found: ${id}`)
  }
}
