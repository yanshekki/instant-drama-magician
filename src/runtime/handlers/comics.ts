import { copyFileSync, existsSync } from 'fs'
import { AppError } from '../../types/errors'
import type { ComicPanelSlot } from '../../domain/comicPanelScript'
import { boundTimelineIdsFromSlots, parsePanelScriptJson } from '../../domain/comicPanelScript'
import { parseComicPageVideos } from '../../domain/comicPageVideos'
import type { HandlerContext } from './context'

export function registerComicsHandlers(ctx: HandlerContext): void {
  const { reg, comics, generation, activity } = ctx

  reg('comics:get', async (storyId: string) => {
    if (!storyId?.trim()) {
      throw new AppError('VALIDATION', 'errors.storyIdRequired')
    }
    return comics().getWithPages(storyId.trim())
  })

  reg(
    'comics:update',
    async (
      storyId: string,
      data: {
        title?: string | null
        artStyle?: string | null
        hardRules?: string | null
        pageFormat?: string | null
      }
    ) => comics().updateComic(storyId, data)
  )

  reg(
    'comics:addPage',
    async (
      storyId: string,
      input?: {
        panelLayout?: string | null
        pageFormat?: string | null
        artStyle?: string | null
        panelScript?: ComicPanelSlot[] | null
      }
    ) => comics().addPage(storyId, input)
  )

  reg(
    'comics:updatePage',
    async (
      pageId: string,
      data: {
        panelLayout?: string | null
        pageFormat?: string | null
        artStyle?: string | null
        panelScript?: ComicPanelSlot[] | null
        panelScriptJson?: string | null
        hardRules?: string | null
      }
    ) => {
      if (!pageId?.trim()) {
        throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
      }
      return comics().updatePage(pageId.trim(), data)
    }
  )

  reg('comics:deletePage', async (pageId: string) => {
    if (!pageId?.trim()) {
      throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
    }
    const r = await comics().deletePage(pageId.trim())
    const store = generation().getMediaStore()
    const videos = parseComicPageVideos(r.videoGalleryJson, {
      videoPath: r.videoPath
    })
    for (const path of [
      r.imagePath,
      ...videos.map((v) => v.path)
    ]) {
      if (!path) continue
      try {
        store.deleteIfExists(path)
      } catch {
        /* ignore */
      }
    }
    return { ok: true as const }
  })

  reg('comics:deletePageVideo', async (pageId: string, videoId: string) => {
    if (!pageId?.trim()) {
      throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
    }
    if (!videoId?.trim()) {
      throw new AppError('VALIDATION', 'errors.comicVideoNotFound')
    }
    const r = await comics().deletePageVideo(pageId.trim(), videoId.trim())
    try {
      generation().getMediaStore().deleteIfExists(r.removedPath)
    } catch {
      /* ignore */
    }
    return r
  })

  reg('comics:setPageVideoPrimary', async (pageId: string, videoId: string) => {
    if (!pageId?.trim()) {
      throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
    }
    if (!videoId?.trim()) {
      throw new AppError('VALIDATION', 'errors.comicVideoNotFound')
    }
    return comics().setPageVideoPrimary(pageId.trim(), videoId.trim())
  })

  reg(
    'comics:autoPaginate',
    async (storyId: string, layoutId?: string | null) => {
      if (!storyId?.trim()) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      const r = await comics().autoPaginateFromTimeline(storyId.trim(), layoutId)
      activity.append({
        kind: 'app',
        level: 'info',
        message: 'comicsAutoPaginate',
        meta: { storyId, created: r.created, layout: r.layout }
      })
      return r
    }
  )

  reg('comics:importToTimeline', async (pageId: string) => {
    if (!pageId?.trim()) {
      throw new AppError('VALIDATION', 'errors.comicPageIdRequired')
    }
    const page = await comics().getPage(pageId.trim())
    const src = page.imagePath?.trim()
    if (!src || !existsSync(src)) {
      throw new AppError('VALIDATION', 'errors.comicsNeedImage')
    }
    const comic = await comics().getById(page.comicId)
    const slots = parsePanelScriptJson(page.panelScriptJson, page.panelLayout)
    const entryIds = [...new Set(boundTimelineIdsFromSlots(slots))]
    const store = generation().getMediaStore()
    store.ensureStoryDirs(comic.storyId)
    const imported: string[] = []
    for (const entryId of entryIds) {
      const dest = store.clipContinuityStillPath(comic.storyId, entryId, '.png')
      try {
        copyFileSync(src, dest)
        store.clearEntryStillUserCleared(comic.storyId, entryId)
        imported.push(entryId)
      } catch {
        /* skip one beat */
      }
    }
    activity.append({
      kind: 'app',
      level: 'info',
      message: 'comicsImportToTimeline',
      meta: { pageId: page.id, storyId: comic.storyId, imported: imported.length }
    })
    return { imported: imported.length, entryIds: imported, path: src }
  })
}
