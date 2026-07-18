/**
 * Global wardrobe library — costumes are independent assets linked 0..N to characters.
 */
import type { PrismaClient } from '../../types/prisma'
import { AppError } from '../../types/errors'
import {
  parseCharacterCostumes,
  type CharacterCostumeEntry
} from '../../domain/characterCostumes'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

/** Process-wide: CostumeService is constructed per IPC invoke, so instance flags race. */
let migrateDone = false
let migrateInflight: Promise<{ created: number; linked: number }> | null = null

export interface CreateCostumeInput {
  name: string
  description: string
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  seedPrompt?: string | null
  /** Optional character ids to link on create */
  characterIds?: string[]
}

export interface UpdateCostumeInput {
  name?: string
  description?: string
  artStyle?: string | null
  refImagePath?: string | null
  refGalleryJson?: string | null
  seedPrompt?: string | null
  /** Replace full set of linked characters when provided */
  characterIds?: string[]
}

export type CostumeWithLinks = Awaited<
  ReturnType<CostumeService['list']>
>[number]

export class CostumeService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * One-shot: lift Character.costumesJson entries into Costume + CharacterCostume.
   * Idempotent and concurrency-safe (module lock + upsert links).
   */
  async ensureMigratedFromJson(): Promise<{ created: number; linked: number }> {
    if (migrateDone) return { created: 0, linked: 0 }
    if (migrateInflight) return migrateInflight
    migrateInflight = this.runMigration()
      .then((r) => {
        migrateDone = true
        return r
      })
      .finally(() => {
        migrateInflight = null
      })
    return migrateInflight
  }

  private async runMigration(): Promise<{ created: number; linked: number }> {
    const chars = await this.prisma.character.findMany({
      select: {
        id: true,
        costume: true,
        costumesJson: true,
        artStyle: true
      }
    })
    let created = 0
    let linked = 0
    for (const c of chars) {
      const entries = parseCharacterCostumes(c.costumesJson)
      // De-dupe by description so the same look is not linked twice in one pass
      const seenDesc = new Set<string>()
      for (const e of entries) {
        const key = e.description.trim().toLowerCase()
        if (!key || seenDesc.has(key)) continue
        seenDesc.add(key)
        const r = await this.ensureEntryForCharacter(c.id, e)
        if (r.created) created++
        if (r.linked) linked++
      }
      // Active costume text with no library entry → create + link
      const active = (c.costume ?? '').trim()
      if (active) {
        const key = active.toLowerCase()
        if (!seenDesc.has(key)) {
          const r = await this.ensureEntryForCharacter(c.id, {
            id: `orphan_${c.id}`,
            name: active.slice(0, 32),
            description: active,
            artStyle: c.artStyle,
            imagePath: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })
          if (r.created) created++
          if (r.linked) linked++
        }
      }
    }
    return { created, linked }
  }

  private async ensureEntryForCharacter(
    characterId: string,
    e: CharacterCostumeEntry
  ): Promise<{ created: boolean; linked: boolean }> {
    const desc = e.description.trim()
    if (!desc) return { created: false, linked: false }
    // Find existing costume with same description
    const existing = await this.prisma.costume.findFirst({
      where: { description: desc }
    })
    let costumeId = existing?.id
    let created = false
    if (!costumeId) {
      try {
        const row = await this.prisma.costume.create({
          data: {
            name: e.name.trim() || desc.slice(0, 32),
            description: desc,
            artStyle: trimOrNull(e.artStyle),
            refImagePath: trimOrNull(e.imagePath)
          }
        })
        costumeId = row.id
        created = true
      } catch {
        // Concurrent create of same description — re-fetch
        const again = await this.prisma.costume.findFirst({
          where: { description: desc }
        })
        if (!again) throw new AppError('INTERNAL', 'Failed to create costume')
        costumeId = again.id
      }
    }
    const dressed = trimOrNull(e.imagePath)
    // Upsert avoids unique races when list/get run in parallel (React Strict Mode, etc.)
    const before = await this.prisma.characterCostume.findUnique({
      where: {
        characterId_costumeId: { characterId, costumeId }
      }
    })
    await this.prisma.characterCostume.upsert({
      where: {
        characterId_costumeId: { characterId, costumeId }
      },
      create: {
        characterId,
        costumeId,
        dressedImagePath: dressed
      },
      update: dressed
        ? { dressedImagePath: dressed }
        : {}
    })
    return { created, linked: !before }
  }

  async list(opts?: { q?: string; characterId?: string; unlinkedOnly?: boolean }) {
    await this.ensureMigratedFromJson()
    const q = opts?.q?.trim()
    return this.prisma.costume.findMany({
      where: {
        AND: [
          q
            ? {
                OR: [
                  { name: { contains: q } },
                  { description: { contains: q } }
                ]
              }
            : {},
          opts?.characterId
            ? { characterLinks: { some: { characterId: opts.characterId } } }
            : {},
          opts?.unlinkedOnly
            ? { characterLinks: { none: {} } }
            : {}
        ]
      },
      include: {
        characterLinks: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                costume: true,
                refImagePath: true
              }
            }
          },
          orderBy: { sortOrder: 'asc' }
        }
      },
      orderBy: { updatedAt: 'desc' }
    })
  }

  async listForCharacter(characterId: string) {
    await this.ensureMigratedFromJson()
    const links = await this.prisma.characterCostume.findMany({
      where: { characterId },
      include: { costume: true },
      orderBy: { sortOrder: 'asc' }
    })
    return links.map((l) => ({
      ...l.costume,
      dressedImagePath: l.dressedImagePath,
      sortOrder: l.sortOrder,
      isActive: Boolean(
        l.characterId &&
          // active if character.costume text matches — loaded separately if needed
          false
      )
    }))
  }

  async get(id: string) {
    await this.ensureMigratedFromJson()
    const row = await this.prisma.costume.findUnique({
      where: { id },
      include: {
        characterLinks: {
          include: {
            character: {
              select: {
                id: true,
                name: true,
                costume: true,
                refImagePath: true,
                refGalleryJson: true,
                artStyle: true
              }
            }
          }
        }
      }
    })
    if (!row) throw new AppError('NOT_FOUND', `Costume not found: ${id}`)
    return row
  }

  async create(input: CreateCostumeInput) {
    const description = input.description.trim()
    if (!description) {
      throw new AppError('VALIDATION', 'description is required')
    }
    const name = (input.name.trim() || description.slice(0, 32)).trim()
    const characterIds = [
      ...new Set((input.characterIds ?? []).filter(Boolean))
    ]
    for (const cid of characterIds) {
      const c = await this.prisma.character.findUnique({ where: { id: cid } })
      if (!c) throw new AppError('NOT_FOUND', `Character not found: ${cid}`)
    }
    return this.prisma.costume.create({
      data: {
        name,
        description,
        artStyle: trimOrNull(input.artStyle),
        refImagePath: trimOrNull(input.refImagePath),
        refGalleryJson: trimOrNull(input.refGalleryJson),
        seedPrompt: trimOrNull(input.seedPrompt),
        characterLinks: characterIds.length
          ? {
              create: characterIds.map((characterId, i) => ({
                characterId,
                sortOrder: i
              }))
            }
          : undefined
      },
      include: {
        characterLinks: {
          include: {
            character: {
              select: { id: true, name: true, costume: true, refImagePath: true }
            }
          }
        }
      }
    })
  }

  async update(id: string, data: UpdateCostumeInput) {
    await this.get(id)
    if (data.description !== undefined && !data.description.trim()) {
      throw new AppError('VALIDATION', 'description is required')
    }
    if (data.characterIds) {
      const characterIds = [...new Set(data.characterIds.filter(Boolean))]
      for (const cid of characterIds) {
        const c = await this.prisma.character.findUnique({ where: { id: cid } })
        if (!c) throw new AppError('NOT_FOUND', `Character not found: ${cid}`)
      }
      await this.prisma.characterCostume.deleteMany({
        where: { costumeId: id }
      })
      if (characterIds.length) {
        // SQLite: createMany does not support skipDuplicates; links were cleared above.
        await this.prisma.characterCostume.createMany({
          data: characterIds.map((characterId, i) => ({
            characterId,
            costumeId: id,
            sortOrder: i
          }))
        })
      }
    }
    return this.prisma.costume.update({
      where: { id },
      data: {
        ...(data.name !== undefined
          ? { name: data.name.trim() || undefined }
          : {}),
        ...(data.description !== undefined
          ? { description: data.description.trim() }
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
        ...(data.seedPrompt !== undefined
          ? { seedPrompt: trimOrNull(data.seedPrompt) }
          : {})
      },
      include: {
        characterLinks: {
          include: {
            character: {
              select: { id: true, name: true, costume: true, refImagePath: true }
            }
          }
        }
      }
    })
  }

  async delete(id: string) {
    const row = await this.get(id)
    // Block if any linked character currently uses this description as active
    for (const link of row.characterLinks) {
      const active = (link.character.costume ?? '').trim().toLowerCase()
      if (active && active === row.description.trim().toLowerCase()) {
        throw new AppError(
          'CONFLICT',
          'Costume is active on a character',
          `In use by: ${link.character.name}`
        )
      }
    }
    await this.prisma.costume.delete({ where: { id } })
    return { ok: true as const }
  }

  async linkCharacter(costumeId: string, characterId: string) {
    await this.get(costumeId)
    const c = await this.prisma.character.findUnique({
      where: { id: characterId }
    })
    if (!c) throw new AppError('NOT_FOUND', `Character not found: ${characterId}`)
    await this.prisma.characterCostume.upsert({
      where: {
        characterId_costumeId: { characterId, costumeId }
      },
      create: { characterId, costumeId },
      update: {}
    })
    return this.get(costumeId)
  }

  async unlinkCharacter(costumeId: string, characterId: string) {
    const row = await this.get(costumeId)
    const link = row.characterLinks.find((l) => l.characterId === characterId)
    if (link) {
      const active = (link.character.costume ?? '').trim().toLowerCase()
      if (active && active === row.description.trim().toLowerCase()) {
        throw new AppError(
          'CONFLICT',
          'Cannot unlink active costume',
          'Set another active costume on the character first'
        )
      }
    }
    await this.prisma.characterCostume.deleteMany({
      where: { costumeId, characterId }
    })
    return this.get(costumeId)
  }

  async setActiveOnCharacter(costumeId: string, characterId: string) {
    const row = await this.get(costumeId)
    // Ensure link exists
    await this.linkCharacter(costumeId, characterId)
    await this.prisma.character.update({
      where: { id: characterId },
      data: {
        costume: row.description,
        ...(row.artStyle ? { artStyle: row.artStyle } : {})
      }
    })
    return this.get(costumeId)
  }

  async setDressedImage(
    costumeId: string,
    characterId: string,
    dressedImagePath: string
  ) {
    await this.linkCharacter(costumeId, characterId)
    await this.prisma.characterCostume.update({
      where: {
        characterId_costumeId: { characterId, costumeId }
      },
      data: { dressedImagePath }
    })
    return this.get(costumeId)
  }
}
