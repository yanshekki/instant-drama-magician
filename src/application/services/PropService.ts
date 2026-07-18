import type { PrismaClient } from '../../types/prisma'
import type { CreatePropInput, UpdatePropInput } from '../../types/domain'
import { AppError } from '../../types/errors'
import { StoryCastService } from './StoryCastService'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

export class PropService {
  constructor(private readonly prisma: PrismaClient) {}

  list(opts?: { q?: string }) {
    const q = opts?.q?.trim()
    return this.prisma.prop.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } }
            ]
          }
        : undefined,
      orderBy: { name: 'asc' }
    })
  }

  listForStory(storyId: string) {
    return new StoryCastService(this.prisma).listPropsForStory(storyId)
  }

  async get(id: string) {
    const row = await this.prisma.prop.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', `Prop not found: ${id}`)
    return row
  }

  async create(input: CreatePropInput & { linkStoryId?: string | null }) {
    if (!input.name.trim()) throw new AppError('VALIDATION', 'name is required')
    const row = await this.prisma.prop.create({
      data: {
        name: input.name.trim(),
        description: input.description.trim(),
        material: trimOrNull(input.material),
        sizeNotes: trimOrNull(input.sizeNotes),
        condition: trimOrNull(input.condition),
        visualTags: trimOrNull(input.visualTags),
        artStyle: trimOrNull(input.artStyle),
        refImagePath: trimOrNull(input.refImagePath),
        refGalleryJson: trimOrNull(input.refGalleryJson),
        profileJson: trimOrNull(input.profileJson),
        seedPrompt: trimOrNull(input.seedPrompt)
      }
    })
    const linkStoryId = input.linkStoryId ?? input.storyId
    if (linkStoryId) {
      await new StoryCastService(this.prisma).linkProp(linkStoryId, row.id)
    }
    return row
  }

  async update(id: string, data: UpdatePropInput) {
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
          : {}),
        ...(data.material !== undefined
          ? { material: trimOrNull(data.material) }
          : {}),
        ...(data.sizeNotes !== undefined
          ? { sizeNotes: trimOrNull(data.sizeNotes) }
          : {}),
        ...(data.condition !== undefined
          ? { condition: trimOrNull(data.condition) }
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
        ...(data.profileJson !== undefined
          ? { profileJson: trimOrNull(data.profileJson) }
          : {}),
        ...(data.seedPrompt !== undefined
          ? { seedPrompt: trimOrNull(data.seedPrompt) }
          : {})
      }
    })
  }

  async delete(id: string) {
    await this.ensureExists(id)
    await this.prisma.prop.delete({ where: { id } })
    return { ok: true as const }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.prop.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', `Prop not found: ${id}`)
  }
}
