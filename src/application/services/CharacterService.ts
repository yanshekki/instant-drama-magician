import type { PrismaClient } from '../../types/prisma'
import type { CreateCharacterInput } from '../../types/domain'
import { AppError } from '../../types/errors'
import { validateCharacterName } from '../../domain/character'

export class CharacterService {
  constructor(private readonly prisma: PrismaClient) {}

  list(storyId: string) {
    return this.prisma.character.findMany({
      where: { storyId },
      orderBy: { name: 'asc' }
    })
  }

  async create(input: CreateCharacterInput) {
    await this.ensureStory(input.storyId)
    const nameErr = validateCharacterName(input.name)
    if (nameErr) throw new AppError('VALIDATION', nameErr)
    return this.prisma.character.create({
      data: {
        storyId: input.storyId,
        name: input.name.trim(),
        description: input.description.trim(),
        soulMdPath: input.soulMdPath ?? null,
        refImagePath: input.refImagePath ?? null
      }
    })
  }

  async update(
    id: string,
    data: Partial<Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>>
  ) {
    await this.ensureExists(id)
    if (data.name !== undefined) {
      const nameErr = validateCharacterName(data.name)
      if (nameErr) throw new AppError('VALIDATION', nameErr)
    }
    return this.prisma.character.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description.trim() } : {}),
        ...(data.soulMdPath !== undefined ? { soulMdPath: data.soulMdPath } : {}),
        ...(data.refImagePath !== undefined ? { refImagePath: data.refImagePath } : {})
      }
    })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.character.delete({ where: { id } })
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
    const found = await this.prisma.character.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', `Character not found: ${id}`)
  }
}
