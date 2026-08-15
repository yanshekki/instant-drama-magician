import type { PrismaClient } from '../../types/prisma'
import { AppError } from '../../types/errors'
import {
  coerceComicPageLayout,
  getComicPageLayout,
  type ComicPageLayoutId
} from '../../domain/comicPageLayouts'
import { coerceComicPageFormat } from '../../domain/comicPageFormat'
import {
  boundTimelineIdsFromSlots,
  captionFromTimelineBeat,
  normalizePanelSlots,
  paginateTimelineBeats,
  parsePanelScriptJson,
  serializePanelScript,
  type ComicPanelSlot
} from '../../domain/comicPanelScript'
import {
  parseComicPageVideos,
  pickComicPagePrimary,
  serializeComicPageVideos
} from '../../domain/comicPageVideos'

function trimOrNull(v: string | null | undefined): string | null {
  if (v === undefined || v === null) return null
  const t = v.trim()
  return t.length ? t : null
}

export type ComicBookUpdate = {
  title?: string | null
  artStyle?: string | null
  hardRules?: string | null
  pageFormat?: string | null
}

export type ComicPageUpdate = {
  panelLayout?: string | null
  pageFormat?: string | null
  artStyle?: string | null
  panelScript?: ComicPanelSlot[] | null
  panelScriptJson?: string | null
  imagePath?: string | null
  videoPath?: string | null
  videoGalleryJson?: string | null
  refGalleryJson?: string | null
  mediaStatus?: 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
  mediaError?: string | null
  seedPrompt?: string | null
  hardRules?: string | null
  order?: number
}

let comicSchemaReady = false

/** Create Comic / ComicPage if this data root was opened before the feature shipped. */
async function ensureComicPageVideoColumn(prisma: PrismaClient): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ComicPage" ADD COLUMN "videoPath" TEXT`
    )
  } catch {
    /* column already exists */
  }
}

async function ensureComicPageVideoGalleryColumn(
  prisma: PrismaClient
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ComicPage" ADD COLUMN "videoGalleryJson" TEXT`
    )
  } catch {
    /* column already exists */
  }
}

async function ensureComicPageFormatColumns(
  prisma: PrismaClient
): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Comic" ADD COLUMN "pageFormat" TEXT`
    )
  } catch {
    /* column already exists */
  }
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "ComicPage" ADD COLUMN "pageFormat" TEXT`
    )
  } catch {
    /* column already exists */
  }
}

export async function ensureComicSchema(prisma: PrismaClient): Promise<void> {
  if (comicSchemaReady) return
  try {
    await prisma.comic.findFirst({ select: { id: true } })
    await ensureComicPageVideoColumn(prisma)
    await ensureComicPageVideoGalleryColumn(prisma)
    await ensureComicPageFormatColumns(prisma)
    comicSchemaReady = true
    return
  } catch {
    /* table missing — create */
  }
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Comic" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "storyId" TEXT NOT NULL,
      "title" TEXT,
      "artStyle" TEXT,
      "hardRules" TEXT,
      "pageFormat" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "Comic_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS "Comic_storyId_key" ON "Comic"("storyId")`
  )
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ComicPage" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "comicId" TEXT NOT NULL,
      "order" INTEGER NOT NULL DEFAULT 0,
      "panelLayout" TEXT NOT NULL,
      "pageFormat" TEXT,
      "artStyle" TEXT,
      "panelScriptJson" TEXT,
      "imagePath" TEXT,
      "videoPath" TEXT,
      "videoGalleryJson" TEXT,
      "refGalleryJson" TEXT,
      "mediaStatus" TEXT NOT NULL DEFAULT 'EMPTY',
      "mediaError" TEXT,
      "seedPrompt" TEXT,
      "hardRules" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ComicPage_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
  `)
  await prisma.$executeRawUnsafe(
    `CREATE INDEX IF NOT EXISTS "ComicPage_comicId_order_idx" ON "ComicPage"("comicId", "order")`
  )
  await ensureComicPageVideoColumn(prisma)
  await ensureComicPageVideoGalleryColumn(prisma)
  await ensureComicPageFormatColumns(prisma)
  comicSchemaReady = true
}

/** Test-only: allow re-running ensure after a mocked miss. */
export function resetComicSchemaFlag(): void {
  comicSchemaReady = false
}

export class ComicService {
  constructor(private readonly prisma: PrismaClient) {}

  async getOrCreate(storyId: string) {
    await ensureComicSchema(this.prisma)
    const sid = storyId.trim()
    if (!sid) throw new AppError('VALIDATION', 'errors.storyIdRequired')
    const story = await this.prisma.story.findUnique({
      where: { id: sid },
      select: { id: true, title: true, artStyle: true, hardRules: true }
    })
    if (!story) throw new AppError('NOT_FOUND', 'errors.storyNotFound', sid)
    try {
      return await this.prisma.comic.upsert({
        where: { storyId: sid },
        create: {
          storyId: sid,
          title: story.title,
          artStyle: story.artStyle ?? null,
          hardRules: story.hardRules ?? null,
          pageFormat: 'tall'
        },
        update: {}
      })
    } catch (e) {
      const again = await this.prisma.comic.findUnique({
        where: { storyId: sid }
      })
      if (again) return again
      throw e
    }
  }

  async getWithPages(storyId: string) {
    const comic = await this.getOrCreate(storyId)
    const pages = await this.prisma.comicPage.findMany({
      where: { comicId: comic.id },
      orderBy: [{ order: 'asc' }, { id: 'asc' }]
    })
    return { comic, pages }
  }

  async getById(id: string) {
    await ensureComicSchema(this.prisma)
    const row = await this.prisma.comic.findUnique({ where: { id } })
    if (!row) throw new AppError('NOT_FOUND', 'errors.comicNotFound', id)
    return row
  }

  async getPage(pageId: string) {
    await ensureComicSchema(this.prisma)
    const row = await this.prisma.comicPage.findUnique({
      where: { id: pageId }
    })
    if (!row) throw new AppError('NOT_FOUND', 'errors.comicPageNotFound', pageId)
    return row
  }

  async updateComic(storyId: string, data: ComicBookUpdate) {
    const comic = await this.getOrCreate(storyId)
    return this.prisma.comic.update({
      where: { id: comic.id },
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

  async addPage(
    storyId: string,
    input?: {
      panelLayout?: string | null
      pageFormat?: string | null
      artStyle?: string | null
      panelScript?: ComicPanelSlot[] | null
    }
  ) {
    const comic = await this.getOrCreate(storyId)
    const layout = coerceComicPageLayout(input?.panelLayout)
    const max = await this.prisma.comicPage.aggregate({
      where: { comicId: comic.id },
      _max: { order: true }
    })
    const order = (max._max.order ?? -1) + 1
    const slots = normalizePanelSlots(input?.panelScript ?? [], getComicPageLayout(layout).panelCount)
    return this.prisma.comicPage.create({
      data: {
        comicId: comic.id,
        order,
        panelLayout: layout,
        pageFormat:
          coerceComicPageFormat(input?.pageFormat) ??
          coerceComicPageFormat(comic.pageFormat) ??
          getComicPageLayout(layout).sizeClass,
        artStyle: trimOrNull(input?.artStyle) ?? comic.artStyle,
        panelScriptJson: serializePanelScript(slots),
        mediaStatus: 'EMPTY'
      }
    })
  }

  async updatePage(pageId: string, data: ComicPageUpdate) {
    const row = await this.getPage(pageId)
    let panelLayout = row.panelLayout
    let panelScriptJson = row.panelScriptJson
    if (data.panelLayout !== undefined) {
      panelLayout = coerceComicPageLayout(data.panelLayout)
    }
    if (data.panelScript !== undefined || data.panelScriptJson !== undefined) {
      const raw =
        data.panelScript !== undefined
          ? data.panelScript
          : data.panelScriptJson
            ? (() => {
                try {
                  return JSON.parse(data.panelScriptJson) as unknown
                } catch {
                  return []
                }
              })()
            : []
      panelScriptJson = serializePanelScript(
        normalizePanelSlots(raw, getComicPageLayout(panelLayout).panelCount)
      )
    } else if (data.panelLayout !== undefined) {
      panelScriptJson = serializePanelScript(
        parsePanelScriptJson(row.panelScriptJson, panelLayout)
      )
    }
    return this.prisma.comicPage.update({
      where: { id: pageId },
      data: {
        panelLayout,
        panelScriptJson,
        ...(data.artStyle !== undefined
          ? { artStyle: trimOrNull(data.artStyle) }
          : {}),
        ...(data.pageFormat !== undefined
          ? { pageFormat: coerceComicPageFormat(data.pageFormat) }
          : {}),
        ...(data.imagePath !== undefined
          ? { imagePath: trimOrNull(data.imagePath) }
          : {}),
        ...(data.videoPath !== undefined
          ? { videoPath: trimOrNull(data.videoPath) }
          : {}),
        ...(data.videoGalleryJson !== undefined
          ? { videoGalleryJson: trimOrNull(data.videoGalleryJson) }
          : {}),
        ...(data.refGalleryJson !== undefined
          ? { refGalleryJson: trimOrNull(data.refGalleryJson) }
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

  async deletePage(pageId: string) {
    const row = await this.getPage(pageId)
    await this.prisma.comicPage.delete({ where: { id: pageId } })
    return {
      ok: true as const,
      id: row.id,
      imagePath: row.imagePath,
      videoPath: row.videoPath,
      videoGalleryJson: row.videoGalleryJson
    }
  }

  async deletePageVideo(pageId: string, videoId: string) {
    const id = pageId.trim()
    const vid = videoId.trim()
    if (!id) throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
    if (!vid) throw new AppError('VALIDATION', 'errors.comicVideoNotFound')
    const row = await this.getPage(id)
    const items = parseComicPageVideos(row.videoGalleryJson, {
      videoPath: row.videoPath
    })
    const hit = items.find((v) => v.id === vid)
    if (!hit) throw new AppError('VALIDATION', 'errors.comicVideoNotFound')
    const next = items.filter((v) => v.id !== vid)
    const primary = pickComicPagePrimary(
      next,
      row.videoPath === hit.path ? null : row.videoPath
    )
    const updated = await this.updatePage(id, {
      videoPath: primary,
      videoGalleryJson: serializeComicPageVideos(next)
    })
    return {
      ok: true as const,
      removedPath: hit.path,
      videoPath: primary,
      videos: next,
      page: updated
    }
  }

  async setPageVideoPrimary(pageId: string, videoId: string) {
    const id = pageId.trim()
    const vid = videoId.trim()
    if (!id) throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
    if (!vid) throw new AppError('VALIDATION', 'errors.comicVideoNotFound')
    const row = await this.getPage(id)
    const items = parseComicPageVideos(row.videoGalleryJson, {
      videoPath: row.videoPath
    })
    const hit = items.find((v) => v.id === vid)
    if (!hit) throw new AppError('VALIDATION', 'errors.comicVideoNotFound')
    const updated = await this.updatePage(id, { videoPath: hit.path })
    return { ok: true as const, videoPath: hit.path, page: updated }
  }

  async autoPaginateFromTimeline(
    storyId: string,
    layoutId?: string | null
  ) {
    const sid = storyId.trim()
    if (!sid) throw new AppError('VALIDATION', 'errors.storyIdRequired')
    const comic = await this.getOrCreate(sid)
    const layout = getComicPageLayout(layoutId)
    const entries = await this.prisma.timelineEntry.findMany({
      where: { storyId: sid },
      orderBy: [{ startTime: 'asc' }, { order: 'asc' }]
    })
    if (entries.length === 0) {
      throw new AppError('VALIDATION', 'errors.comicsNoTimeline')
    }
    const existing = await this.prisma.comicPage.findMany({
      where: { comicId: comic.id },
      select: { panelScriptJson: true, panelLayout: true }
    })
    const bound = new Set<string>()
    for (const p of existing) {
      for (const id of boundTimelineIdsFromSlots(
        parsePanelScriptJson(p.panelScriptJson, p.panelLayout)
      )) {
        bound.add(id)
      }
    }
    const chunks = paginateTimelineBeats(entries, layout.panelCount, bound)
    if (chunks.length === 0) {
      throw new AppError('VALIDATION', 'errors.comicsNoUnboundBeats')
    }
    const max = await this.prisma.comicPage.aggregate({
      where: { comicId: comic.id },
      _max: { order: true }
    })
    let order = (max._max.order ?? -1) + 1
    const created = []
    for (const chunk of chunks) {
      const slots = normalizePanelSlots(
        chunk.map((e) => ({
          caption: captionFromTimelineBeat({
            dialogue: e.dialogue,
            beatContentJson: e.beatContentJson
          }),
          timelineEntryId: e.id,
          characterIds: [],
          sceneId: e.sceneId,
          propId: e.propId,
          actionId: e.actionId
        })),
        layout.panelCount
      )
      created.push(
        await this.prisma.comicPage.create({
          data: {
            comicId: comic.id,
            order,
            panelLayout: layout.id,
            pageFormat:
              coerceComicPageFormat(comic.pageFormat) ?? layout.sizeClass,
            artStyle: comic.artStyle,
            panelScriptJson: serializePanelScript(slots),
            mediaStatus: 'EMPTY'
          }
        })
      )
      order += 1
    }
    return { pages: created, created: created.length, layout: layout.id }
  }
}

export type { ComicPageLayoutId }
