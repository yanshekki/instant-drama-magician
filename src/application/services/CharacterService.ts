import type { PrismaClient } from '../../types/prisma'
import type {
  CreateCharacterInput,
  UpdateCharacterInput
} from '../../types/domain'
import { AppError } from '../../types/errors'
import { validateCharacterName } from '../../domain/character'
import { StoryCastService } from './StoryCastService'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

export class CharacterService {
  constructor(private readonly prisma: PrismaClient) {}

  /** Global library list. */
  list(opts?: { q?: string }) {
    const q = opts?.q?.trim()
    return this.prisma.character.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } }
            ]
          }
        : undefined,
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }]
    })
  }

  listForStory(storyId: string) {
    return new StoryCastService(this.prisma).listCharactersForStory(storyId)
  }

  async get(id: string) {
    const row = await this.prisma.character.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', 'errors.characterNotFound', String(id))
    return row
  }

  async create(
    input: CreateCharacterInput & { linkStoryId?: string | null }
  ) {
    const nameErr = validateCharacterName(input.name)
    if (nameErr) throw new AppError('VALIDATION', nameErr)
    const row = await this.prisma.character.create({
      data: {
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
        spokenLanguages: trimOrNull(input.spokenLanguages),
        mannerisms: trimOrNull(input.mannerisms),
        relationships: trimOrNull(input.relationships),
        visualTags: trimOrNull(input.visualTags),
        seedPrompt: trimOrNull(input.seedPrompt),
        hardRules: trimOrNull(input.hardRules),
        profileJson: trimOrNull(input.profileJson),
        refSheetPath: trimOrNull(input.refSheetPath),
        refGalleryJson: trimOrNull(input.refGalleryJson),
        soulHubId: input.soulHubId ?? null,
        artStyle: trimOrNull(input.artStyle),
        costumesJson: trimOrNull(input.costumesJson)
      }
    })
    const linkStoryId = input.linkStoryId ?? input.storyId
    if (linkStoryId) {
      await new StoryCastService(this.prisma).linkCharacter(
        linkStoryId,
        row.id
      )
    }
    return row
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
        ...(data.costume !== undefined
          ? { costume: trimOrNull(data.costume) }
          : {}),
        ...(data.ageRange !== undefined
          ? { ageRange: trimOrNull(data.ageRange) }
          : {}),
        ...(data.gender !== undefined
          ? { gender: trimOrNull(data.gender) }
          : {}),
        ...(data.voiceDesc !== undefined
          ? { voiceDesc: trimOrNull(data.voiceDesc) }
          : {}),
        ...(data.spokenLanguages !== undefined
          ? { spokenLanguages: trimOrNull(data.spokenLanguages) }
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
        ...(data.hardRules !== undefined
          ? { hardRules: trimOrNull(data.hardRules) }
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
        ...(data.soulHubId !== undefined ? { soulHubId: data.soulHubId } : {}),
        ...(data.artStyle !== undefined
          ? { artStyle: trimOrNull(data.artStyle) }
          : {}),
        ...(data.costumesJson !== undefined
          ? { costumesJson: trimOrNull(data.costumesJson) }
          : {})
      }
    })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.character.delete({ where: { id } })
    return { ok: true as const }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.character.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', 'errors.characterNotFound', String(id))
  }
}
