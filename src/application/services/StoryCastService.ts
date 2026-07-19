import type { PrismaClient } from '../../types/prisma'
import { AppError } from '../../types/errors'

/**
 * Many-to-many: stories select global Character / Scene / Prop assets.
 */
export class StoryCastService {
  constructor(private readonly prisma: PrismaClient) {}

  async listCharactersForStory(storyId: string) {
    await this.ensureStory(storyId)
    const links = await this.prisma.storyCharacter.findMany({
      where: { storyId },
      orderBy: { sortOrder: 'asc' },
      include: { character: true, costume: true }
    })
    return links.map((l) => ({
      ...l.character,
      sortOrder: l.sortOrder,
      roleNote: l.roleNote,
      storyCostumeId: l.costumeId,
      storyCostume: l.costume
        ? {
            id: l.costume.id,
            name: l.costume.name,
            description: l.costume.description,
            refImagePath: l.costume.refImagePath
          }
        : null,
      linked: true as const
    }))
  }

  async listScenesForStory(storyId: string) {
    await this.ensureStory(storyId)
    const links = await this.prisma.storyScene.findMany({
      where: { storyId },
      orderBy: [{ sceneNumber: 'asc' }, { sortOrder: 'asc' }],
      include: { scene: true }
    })
    return links.map((l) => ({
      ...l.scene,
      sceneNumber: l.sceneNumber,
      sortOrder: l.sortOrder,
      script: l.scriptOverride ?? l.scene.script,
      status: l.statusOverride ?? l.scene.status,
      linked: true as const
    }))
  }

  async listPropsForStory(storyId: string) {
    await this.ensureStory(storyId)
    const links = await this.prisma.storyProp.findMany({
      where: { storyId },
      orderBy: { sortOrder: 'asc' },
      include: { prop: true }
    })
    return links.map((l) => ({
      ...l.prop,
      sortOrder: l.sortOrder,
      linked: true as const
    }))
  }

  async linkCharacter(
    storyId: string,
    characterId: string,
    opts?: {
      sortOrder?: number
      roleNote?: string | null
      costumeId?: string | null
    }
  ) {
    await this.ensureStory(storyId)
    await this.ensureCharacter(characterId)
    if (opts?.costumeId) {
      await this.ensureCostumeLinkedToCharacter(characterId, opts.costumeId)
    }
    const max = await this.prisma.storyCharacter.aggregate({
      where: { storyId },
      _max: { sortOrder: true }
    })
    return this.prisma.storyCharacter.upsert({
      where: {
        storyId_characterId: { storyId, characterId }
      },
      create: {
        storyId,
        characterId,
        sortOrder: opts?.sortOrder ?? (max._max.sortOrder ?? -1) + 1,
        roleNote: opts?.roleNote ?? null,
        costumeId: opts?.costumeId ?? null
      },
      update: {
        ...(opts?.roleNote !== undefined ? { roleNote: opts.roleNote } : {}),
        ...(opts?.sortOrder !== undefined ? { sortOrder: opts.sortOrder } : {}),
        ...(opts?.costumeId !== undefined ? { costumeId: opts.costumeId } : {})
      }
    })
  }

  /**
   * Set or clear the wardrobe this character wears in this story.
   * costumeId must be linked to the character (CharacterCostume), or null.
   */
  async setCharacterCostume(
    storyId: string,
    characterId: string,
    costumeId: string | null
  ) {
    await this.ensureStory(storyId)
    const link = await this.prisma.storyCharacter.findUnique({
      where: { storyId_characterId: { storyId, characterId } }
    })
    if (!link) {
      throw new AppError(
        'VALIDATION',
        'Character is not in this story cast'
      )
    }
    if (costumeId) {
      await this.ensureCostumeLinkedToCharacter(characterId, costumeId)
    }
    return this.prisma.storyCharacter.update({
      where: { storyId_characterId: { storyId, characterId } },
      data: { costumeId },
      include: { costume: true, character: true }
    })
  }

  async unlinkCharacter(storyId: string, characterId: string) {
    await this.ensureStory(storyId)
    const inUse = await this.prisma.timelineEntry.count({
      where: { storyId, characterId }
    })
    if (inUse > 0) {
      throw new AppError(
        'VALIDATION',
        'Cannot remove character: still used on the timeline'
      )
    }
    await this.prisma.storyCharacter.deleteMany({
      where: { storyId, characterId }
    })
    return { ok: true as const }
  }

  async linkScene(
    storyId: string,
    sceneId: string,
    opts?: { sceneNumber?: number; sortOrder?: number }
  ) {
    await this.ensureStory(storyId)
    await this.ensureScene(sceneId)
    // Treat NaN / non-integer as missing (UI can send NaN after bad form state)
    const requested =
      typeof opts?.sceneNumber === 'number' &&
      Number.isFinite(opts.sceneNumber) &&
      Number.isInteger(opts.sceneNumber) &&
      opts.sceneNumber >= 1
        ? opts.sceneNumber
        : undefined
    let sceneNumber = requested
    if (sceneNumber === undefined) {
      const max = await this.prisma.storyScene.aggregate({
        where: { storyId },
        _max: { sceneNumber: true }
      })
      sceneNumber = (max._max.sceneNumber ?? 0) + 1
    }
    const maxSort = await this.prisma.storyScene.aggregate({
      where: { storyId },
      _max: { sortOrder: true }
    })
    return this.prisma.storyScene.upsert({
      where: { storyId_sceneId: { storyId, sceneId } },
      create: {
        storyId,
        sceneId,
        sceneNumber,
        sortOrder: opts?.sortOrder ?? (maxSort._max.sortOrder ?? -1) + 1
      },
      update: {
        ...(requested !== undefined ? { sceneNumber: requested } : {}),
        ...(opts?.sortOrder !== undefined ? { sortOrder: opts.sortOrder } : {})
      }
    })
  }

  async unlinkScene(storyId: string, sceneId: string) {
    await this.ensureStory(storyId)
    const inUse = await this.prisma.timelineEntry.count({
      where: { storyId, sceneId }
    })
    if (inUse > 0) {
      throw new AppError(
        'VALIDATION',
        'Cannot remove scene: still used on the timeline'
      )
    }
    await this.prisma.storyScene.deleteMany({ where: { storyId, sceneId } })
    return { ok: true as const }
  }

  async linkProp(storyId: string, propId: string, opts?: { sortOrder?: number }) {
    await this.ensureStory(storyId)
    await this.ensureProp(propId)
    const max = await this.prisma.storyProp.aggregate({
      where: { storyId },
      _max: { sortOrder: true }
    })
    return this.prisma.storyProp.upsert({
      where: { storyId_propId: { storyId, propId } },
      create: {
        storyId,
        propId,
        sortOrder: opts?.sortOrder ?? (max._max.sortOrder ?? -1) + 1
      },
      update: {
        ...(opts?.sortOrder !== undefined ? { sortOrder: opts.sortOrder } : {})
      }
    })
  }

  async unlinkProp(storyId: string, propId: string) {
    await this.ensureStory(storyId)
    const inUse = await this.prisma.timelineEntry.count({
      where: { storyId, propId }
    })
    if (inUse > 0) {
      throw new AppError(
        'VALIDATION',
        'Cannot remove prop: still used on the timeline'
      )
    }
    await this.prisma.storyProp.deleteMany({ where: { storyId, propId } })
    return { ok: true as const }
  }

  async isCharacterLinked(storyId: string, characterId: string): Promise<boolean> {
    const row = await this.prisma.storyCharacter.findUnique({
      where: { storyId_characterId: { storyId, characterId } }
    })
    return Boolean(row)
  }

  async isSceneLinked(storyId: string, sceneId: string): Promise<boolean> {
    const row = await this.prisma.storyScene.findUnique({
      where: { storyId_sceneId: { storyId, sceneId } }
    })
    return Boolean(row)
  }

  async isPropLinked(storyId: string, propId: string): Promise<boolean> {
    const row = await this.prisma.storyProp.findUnique({
      where: { storyId_propId: { storyId, propId } }
    })
    return Boolean(row)
  }

  private async ensureCostumeLinkedToCharacter(
    characterId: string,
    costumeId: string
  ): Promise<void> {
    const costume = await this.prisma.costume.findUnique({
      where: { id: costumeId },
      select: { id: true }
    })
    if (!costume) throw new AppError('NOT_FOUND', `Costume not found: ${costumeId}`)
    const link = await this.prisma.characterCostume.findUnique({
      where: {
        characterId_costumeId: { characterId, costumeId }
      }
    })
    if (!link) {
      throw new AppError(
        'VALIDATION',
        'Costume is not linked to this character'
      )
    }
  }

  /** Timeline may only reference assets linked to the story. */
  async assertCastMember(
    storyId: string,
    refs: {
      characterId?: string | null
      sceneId?: string | null
      propId?: string | null
      characterIds?: string[] | null
      sceneIds?: string[] | null
      propIds?: string[] | null
    }
  ): Promise<void> {
    const charIds = [
      ...(refs.characterIds ?? []),
      ...(refs.characterId ? [refs.characterId] : [])
    ]
    for (const id of [...new Set(charIds)]) {
      if (!(await this.isCharacterLinked(storyId, id))) {
        throw new AppError(
          'VALIDATION',
          'Character is not linked to this story'
        )
      }
    }
    const sceneIds = [
      ...(refs.sceneIds ?? []),
      ...(refs.sceneId ? [refs.sceneId] : [])
    ]
    for (const id of [...new Set(sceneIds)]) {
      if (!(await this.isSceneLinked(storyId, id))) {
        throw new AppError('VALIDATION', 'Scene is not linked to this story')
      }
    }
    const propIds = [
      ...(refs.propIds ?? []),
      ...(refs.propId ? [refs.propId] : [])
    ]
    for (const id of [...new Set(propIds)]) {
      if (!(await this.isPropLinked(storyId, id))) {
        throw new AppError('VALIDATION', 'Prop is not linked to this story')
      }
    }
  }

  private async ensureStory(storyId: string): Promise<void> {
    const s = await this.prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true }
    })
    if (!s) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
  }

  private async ensureCharacter(id: string): Promise<void> {
    const r = await this.prisma.character.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!r) throw new AppError('NOT_FOUND', `Character not found: ${id}`)
  }

  private async ensureScene(id: string): Promise<void> {
    const r = await this.prisma.scene.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!r) throw new AppError('NOT_FOUND', `Scene not found: ${id}`)
  }

  private async ensureProp(id: string): Promise<void> {
    const r = await this.prisma.prop.findUnique({
      where: { id },
      select: { id: true }
    })
    if (!r) throw new AppError('NOT_FOUND', `Prop not found: ${id}`)
  }
}
