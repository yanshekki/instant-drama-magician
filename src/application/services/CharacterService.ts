import type { PrismaClient } from '../../types/prisma'
import type { CreateCharacterInput, UpdateCharacterInput } from '../../types/domain'
import { AppError } from '../../types/errors'
import { validateCharacterName } from '../../domain/character'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

export class CharacterService {
  constructor(private readonly prisma: PrismaClient) {}

  list(storyId: string) {
    return this.prisma.character.findMany({
      where: { storyId },
      orderBy: { name: 'asc' }
    })
  }

  async get(id: string) {
    const row = await this.prisma.character.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', `Character not found: ${id}`)
    return row
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
        refImagePath: input.refImagePath ?? null,
        appearance: trimOrNull(input.appearance),
        personality: trimOrNull(input.personality),
        backstory: trimOrNull(input.backstory),
        costume: trimOrNull(input.costume),
        ageRange: trimOrNull(input.ageRange),
        gender: trimOrNull(input.gender),
        voiceDesc: trimOrNull(input.voiceDesc),
        mannerisms: trimOrNull(input.mannerisms),
        relationships: trimOrNull(input.relationships),
        visualTags: trimOrNull(input.visualTags),
        seedPrompt: trimOrNull(input.seedPrompt),
        profileJson: trimOrNull(input.profileJson),
        refSheetPath: trimOrNull(input.refSheetPath),
        refGalleryJson: trimOrNull(input.refGalleryJson),
        soulHubId: input.soulHubId ?? null
      }
    })
  }

  async update(id: string, data: UpdateCharacterInput) {
    await this.ensureExists(id)
    if (data.name !== undefined) {
      const nameErr = validateCharacterName(data.name)
      if (nameErr) throw new AppError('VALIDATION', nameErr)
    }
    return this.prisma.character.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.soulMdPath !== undefined ? { soulMdPath: data.soulMdPath } : {}),
        ...(data.refImagePath !== undefined
          ? { refImagePath: data.refImagePath }
          : {}),
        ...(data.appearance !== undefined
          ? { appearance: trimOrNull(data.appearance) }
          : {}),
        ...(data.personality !== undefined
          ? { personality: trimOrNull(data.personality) }
          : {}),
        ...(data.backstory !== undefined
          ? { backstory: trimOrNull(data.backstory) }
          : {}),
        ...(data.costume !== undefined ? { costume: trimOrNull(data.costume) } : {}),
        ...(data.ageRange !== undefined
          ? { ageRange: trimOrNull(data.ageRange) }
          : {}),
        ...(data.gender !== undefined ? { gender: trimOrNull(data.gender) } : {}),
        ...(data.voiceDesc !== undefined
          ? { voiceDesc: trimOrNull(data.voiceDesc) }
          : {}),
        ...(data.mannerisms !== undefined
          ? { mannerisms: trimOrNull(data.mannerisms) }
          : {}),
        ...(data.relationships !== undefined
          ? { relationships: trimOrNull(data.relationships) }
          : {}),
        ...(data.visualTags !== undefined
          ? { visualTags: trimOrNull(data.visualTags) }
          : {}),
        ...(data.seedPrompt !== undefined
          ? { seedPrompt: trimOrNull(data.seedPrompt) }
          : {}),
        ...(data.profileJson !== undefined
          ? { profileJson: trimOrNull(data.profileJson) }
          : {}),
        ...(data.refSheetPath !== undefined
          ? { refSheetPath: trimOrNull(data.refSheetPath) }
          : {}),
        ...(data.refGalleryJson !== undefined
          ? { refGalleryJson: trimOrNull(data.refGalleryJson) }
          : {}),
        ...(data.soulHubId !== undefined ? { soulHubId: data.soulHubId } : {})
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
