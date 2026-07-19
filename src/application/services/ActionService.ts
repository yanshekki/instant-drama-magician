import type { PrismaClient } from '../../types/prisma'
import type { CreateActionInput, UpdateActionInput } from '../../types/domain'
import { AppError } from '../../types/errors'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

export class ActionService {
  constructor(private readonly prisma: PrismaClient) {}

  list(opts?: { q?: string }) {
    const q = opts?.q?.trim()
    return this.prisma.action.findMany({
      where: q
        ? {
            OR: [
              { name: { contains: q } },
              { description: { contains: q } },
              { motionNotes: { contains: q } }
            ]
          }
        : undefined,
      orderBy: { updatedAt: 'desc' }
    })
  }

  async listForStory(storyId: string) {
    const links = await this.prisma.storyAction.findMany({
      where: { storyId },
      orderBy: { sortOrder: 'asc' },
      include: { action: true }
    })
    return links.map((l) => l.action)
  }

  async get(id: string) {
    const row = await this.prisma.action.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', `Action not found: ${id}`)
    return row
  }

  async create(input: CreateActionInput & { linkStoryId?: string | null }) {
    if (!input.name.trim()) throw new AppError('VALIDATION', 'name is required')
    const row = await this.prisma.action.create({
      data: {
        name: input.name.trim(),
        description: (input.description ?? '').trim(),
        motionNotes: trimOrNull(input.motionNotes),
        intention: trimOrNull(input.intention),
        cameraNotes: trimOrNull(input.cameraNotes),
        panelLayout: trimOrNull(input.panelLayout) || 'grid-2x2',
        visualTags: trimOrNull(input.visualTags),
        artStyle: trimOrNull(input.artStyle),
        refImagePath: trimOrNull(input.refImagePath),
        refGalleryJson: trimOrNull(input.refGalleryJson),
        castRefsJson: trimOrNull(input.castRefsJson),
        profileJson: trimOrNull(input.profileJson),
        seedPrompt: trimOrNull(input.seedPrompt)
      }
    })
    const linkStoryId = input.linkStoryId ?? input.storyId
    if (linkStoryId) {
      await this.linkStory(linkStoryId, row.id)
    }
    return row
  }

  async update(id: string, data: UpdateActionInput) {
    await this.ensureExists(id)
    if (data.name !== undefined && !data.name.trim()) {
      throw new AppError('VALIDATION', 'name is required')
    }
    return this.prisma.action.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
          : {}),
        ...(data.motionNotes !== undefined
          ? { motionNotes: trimOrNull(data.motionNotes) }
          : {}),
        ...(data.intention !== undefined
          ? { intention: trimOrNull(data.intention) }
          : {}),
        ...(data.cameraNotes !== undefined
          ? { cameraNotes: trimOrNull(data.cameraNotes) }
          : {}),
        ...(data.panelLayout !== undefined
          ? { panelLayout: trimOrNull(data.panelLayout) || 'grid-2x2' }
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
        ...(data.castRefsJson !== undefined
          ? { castRefsJson: trimOrNull(data.castRefsJson) }
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
    await this.prisma.action.delete({ where: { id } })
    return { ok: true as const }
  }

  async linkStory(storyId: string, actionId: string) {
    const max = await this.prisma.storyAction.aggregate({
      where: { storyId },
      _max: { sortOrder: true }
    })
    const sortOrder = (max._max.sortOrder ?? -1) + 1
    await this.prisma.storyAction.upsert({
      where: { storyId_actionId: { storyId, actionId } },
      create: { storyId, actionId, sortOrder },
      update: {}
    })
    return { ok: true as const }
  }

  async unlinkStory(storyId: string, actionId: string) {
    await this.prisma.storyAction
      .delete({
        where: { storyId_actionId: { storyId, actionId } }
      })
      .catch(() => undefined)
    return { ok: true as const }
  }

  private async ensureExists(id: string): Promise<void> {
    const found = await this.prisma.action.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!found) throw new AppError('NOT_FOUND', `Action not found: ${id}`)
  }
}
