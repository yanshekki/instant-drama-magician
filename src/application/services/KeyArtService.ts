import type { PrismaClient } from '../../types/prisma'
import { AppError } from '../../types/errors'
import { coerceComicPageFormat } from '../../domain/comicPageFormat'
import {
  coerceKeyArtShotType,
  getKeyArtShotType
} from '../../domain/keyArtShotTypes'
import { coerceKeyArtMakeMethod } from '../../domain/keyArtMakeMethods'
import {
  parseKeyArtShotImages,
  pickKeyArtShotPrimary,
  serializeKeyArtShotImages
} from '../../domain/keyArtShotImages'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

function parseIdList(json?: string | null): string[] {
  if (!json?.trim()) return []
  try {
    const arr = JSON.parse(json) as unknown
    if (!Array.isArray(arr)) return []
    return arr.filter((x): x is string => typeof x === 'string' && Boolean(x.trim()))
  } catch {
    return []
  }
}

export type KeyArtBookUpdate = {
  title?: string | null
  artStyle?: string | null
  hardRules?: string | null
  pageFormat?: string | null
}

export type KeyArtShotUpdate = {
  shotType?: string | null
  makeMethod?: string | null
  pageFormat?: string | null
  artStyle?: string | null
  brief?: string | null
  characterIds?: string[] | null
  characterIdsJson?: string | null
  sceneId?: string | null
  timelineEntryId?: string | null
  comicPageId?: string | null
  imagePath?: string | null
  imageGalleryJson?: string | null
  mediaStatus?: 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
  mediaError?: string | null
  seedPrompt?: string | null
  hardRules?: string | null
  order?: number
}

let keyArtSchemaReady = false

export async function ensureKeyArtSchema(prisma: PrismaClient): Promise<void> {
  if (keyArtSchemaReady) return
  try {
    await prisma.keyArt.findFirst({ select: { id: true } })
    keyArtSchemaReady = true
    return
  } catch {
    /* table missing */
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KeyArt" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      "title" TEXT,
      "artStyle" TEXT,
      "hardRules" TEXT,
      "pageFormat" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "KeyArt_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "KeyArt_storyId_key" ON "KeyArt"("storyId")`
  )
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "KeyArtShot" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "keyArtId" TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      "shotType" TEXT NOT NULL,
      "makeMethod" TEXT,
      "pageFormat" TEXT,
      "artStyle" TEXT,
      "brief" TEXT,
      "characterIdsJson" TEXT,
      "sceneId" TEXT,
      "timelineEntryId" TEXT,
      "comicPageId" TEXT,
      "imagePath" TEXT,
      "imageGalleryJson" TEXT,
      "mediaStatus" TEXT NOT NULL DEFAULT 'EMPTY',
      "mediaError" TEXT,
      "seedPrompt" TEXT,
      "hardRules" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "KeyArtShot_keyArtId_fkey" FOREIGN KEY ("keyArtId") REFERENCES "KeyArt" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "KeyArtShot_keyArtId_order_idx" ON "KeyArtShot"("keyArtId", "order")`
  )
  keyArtSchemaReady = true
}

export function resetKeyArtSchemaFlag(): void {
  keyArtSchemaReady = false
}

export class KeyArtService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(storyId: string) {
    await ensureKeyArtSchema(this.prisma)
    const sid = storyId.trim()
    if (!sid) throw new AppError('VALIDATION', 'errors.storyIdRequired')
    const story = await this.prisma.story.findUnique({
      where: { id: sid },
      select: { id: true, title: true, artStyle: true, hardRules: true }
    })
    if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', sid)
    try {
      return await this.prisma.keyArt.upsert({
        where: { storyId: sid },
        create: {
          storyId: sid,
          title: story.title,
          artStyle: story.artStyle ?? null,
          hardRules: story.hardRules ?? null,
          pageFormat: 'wide'
        },
        update: {}
      })
    } catch (e) {
      const again = await this.prisma.keyArt.findUnique({
        where: { storyId: sid }
      })
      if (again) return again
      throw e
    }
  }

  async getWithShots(storyId: string) {
    const book = await this.getOrCreate(storyId)
    const shots = await this.prisma.keyArtShot.findMany({
      where: { keyArtId: book.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }]
    })
    return { book, shots }
  }

  async getById(id: string) {
    await ensureKeyArtSchema(this.prisma)
    const row = await this.prisma.keyArt.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', 'errors.keyArtNotFound', id)
    return row
  }

  async getShot(shotId: string) {
    await ensureKeyArtSchema(this.prisma)
    const row = await this.prisma.keyArtShot.findUnique({
      where: { id: shotId }
    })
    if (!row) throw new AppError('NOT_FOUND', 'errors.keyArtShotNotFound', shotId)
    return row
  }

  async updateBook(storyId: string, data: KeyArtBookUpdate) {
    const book = await this.getOrCreate(storyId)
    return this.prisma.keyArt.update({
      where: { id: book.id },
      data: {
        ...(data.title !== undefined ? { title: trimOrNull(data.title) } : {}),
        ...(data.artStyle !== undefined
          ? { artStyle: trimOrNull(data.artStyle) }
          : {}),
        ...(data.hardRules !== undefined
          ? { hardRules: trimOrNull(data.hardRules) }
          : {}),
        ...(data.pageFormat !== undefined
          ? { pageFormat: coerceComicPageFormat(data.pageFormat) }
          : {})
      }
    })
  }

  async addShot(
    storyId: string,
    input?: {
      shotType?: string | null
      pageFormat?: string | null
      artStyle?: string | null
      brief?: string | null
      characterIds?: string[] | null
      sceneId?: string | null
      timelineEntryId?: string | null
      comicPageId?: string | null
    }
  ) {
    const book = await this.getOrCreate(storyId)
    const type = getKeyArtShotType(input?.shotType)
    const max = await this.prisma.keyArtShot.aggregate({
      where: { keyArtId: book.id },
      _max: { order: true }
    })
    const order = (max._max.order ?? -1) + 1
    return this.prisma.keyArtShot.create({
      data: {
        keyArtId: book.id,
        order,
        shotType: type.id,
        makeMethod: 'fresh',
        pageFormat:
          coerceComicPageFormat(input?.pageFormat) ??
          coerceComicPageFormat(book.pageFormat) ??
          type.sizeClass,
        artStyle: trimOrNull(input?.artStyle) ?? book.artStyle,
        brief: trimOrNull(input?.brief),
        characterIdsJson: input?.characterIds
          ? JSON.stringify(input.characterIds)
          : null,
        sceneId: trimOrNull(input?.sceneId),
        timelineEntryId: trimOrNull(input?.timelineEntryId),
        comicPageId: trimOrNull(input?.comicPageId),
        mediaStatus: 'EMPTY'
      }
    })
  }

  async updateShot(shotId: string, data: KeyArtShotUpdate) {
    const id = shotId.trim()
    if (!id) throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    const row = await this.getShot(id)
    let characterIdsJson = row.characterIdsJson
    if (data.characterIds !== undefined) {
      characterIdsJson = data.characterIds
        ? JSON.stringify(data.characterIds)
        : null
    } else if (data.characterIdsJson !== undefined) {
      characterIdsJson = trimOrNull(data.characterIdsJson)
    }
    const shotType =
      data.shotType !== undefined
        ? coerceKeyArtShotType(data.shotType)
        : row.shotType
    return this.prisma.keyArtShot.update({
      where: { id },
      data: {
        shotType,
        ...(data.makeMethod !== undefined
          ? { makeMethod: coerceKeyArtMakeMethod(data.makeMethod) }
          : {}),
        ...(data.pageFormat !== undefined
          ? { pageFormat: coerceComicPageFormat(data.pageFormat) }
          : {}),
        ...(data.artStyle !== undefined
          ? { artStyle: trimOrNull(data.artStyle) }
          : {}),
        ...(data.brief !== undefined ? { brief: trimOrNull(data.brief) } : {}),
        characterIdsJson,
        ...(data.sceneId !== undefined
          ? { sceneId: trimOrNull(data.sceneId) }
          : {}),
        ...(data.timelineEntryId !== undefined
          ? { timelineEntryId: trimOrNull(data.timelineEntryId) }
          : {}),
        ...(data.comicPageId !== undefined
          ? { comicPageId: trimOrNull(data.comicPageId) }
          : {}),
        ...(data.imagePath !== undefined
          ? { imagePath: trimOrNull(data.imagePath) }
          : {}),
        ...(data.imageGalleryJson !== undefined
          ? { imageGalleryJson: trimOrNull(data.imageGalleryJson) }
          : {}),
        ...(data.mediaStatus !== undefined
          ? { mediaStatus: data.mediaStatus }
          : {}),
        ...(data.mediaError !== undefined
          ? { mediaError: trimOrNull(data.mediaError) }
          : {}),
        ...(data.seedPrompt !== undefined
          ? { seedPrompt: trimOrNull(data.seedPrompt) }
          : {}),
        ...(data.hardRules !== undefined
          ? { hardRules: trimOrNull(data.hardRules) }
          : {}),
        ...(data.order !== undefined ? { order: data.order } : {})
      }
    })
  }

  async deleteShot(shotId: string) {
    const row = await this.getShot(shotId)
    await this.prisma.keyArtShot.delete({ where: { id: shotId } })
    return {
      ok: true as const,
      id: row.id,
      imagePath: row.imagePath,
      imageGalleryJson: row.imageGalleryJson
    }
  }

  async deleteShotImage(shotId: string, imageId: string) {
    const id = shotId.trim()
    const iid = imageId.trim()
    if (!id) throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    if (!iid) throw new AppError('VALIDATION', 'errors.keyArtImageNotFound')
    const row = await this.getShot(id)
    const items = parseKeyArtShotImages(row.imageGalleryJson, {
      imagePath: row.imagePath
    })
    const hit = items.find((v) => v.id === iid)
    if (!hit) throw new AppError('VALIDATION', 'errors.keyArtImageNotFound')
    const next = items.filter((v) => v.id !== iid)
    const primary = pickKeyArtShotPrimary(
      next,
      row.imagePath === hit.path ? null : row.imagePath
    )
    const updated = await this.updateShot(id, {
      imagePath: primary,
      imageGalleryJson: serializeKeyArtShotImages(next),
      mediaStatus: next.length ? 'READY' : 'EMPTY'
    })
    return {
      ok: true as const,
      removedPath: hit.path,
      imagePath: primary,
      images: next,
      shot: updated
    }
  }

  async setShotImagePrimary(shotId: string, imageId: string) {
    const id = shotId.trim()
    const iid = imageId.trim()
    if (!id) throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    if (!iid) throw new AppError('VALIDATION', 'errors.keyArtImageNotFound')
    const row = await this.getShot(id)
    const items = parseKeyArtShotImages(row.imageGalleryJson, {
      imagePath: row.imagePath
    })
    const hit = items.find((v) => v.id === iid)
    if (!hit) throw new AppError('VALIDATION', 'errors.keyArtImageNotFound')
    const updated = await this.updateShot(id, { imagePath: hit.path })
    return { ok: true as const, imagePath: hit.path, shot: updated }
  }

  async setAsStoryCover(shotId: string) {
    const shot = await this.getShot(shotId)
    const path = shot.imagePath?.trim()
    if (!path) throw new AppError('VALIDATION', 'errors.keyArtNeedImage')
    const book = await this.getById(shot.keyArtId)
    await this.prisma.story.update({
      where: { id: book.storyId },
      data: { coverPath: path }
    })
    return { ok: true as const, storyId: book.storyId, coverPath: path }
  }

  parseCharacterIds(json?: string | null): string[] {
    return parseIdList(json)
  }
}
