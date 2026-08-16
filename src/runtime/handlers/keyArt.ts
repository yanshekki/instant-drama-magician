import { AppError } from '../../types/errors'
import { parseKeyArtShotImages } from '../../domain/keyArtShotImages'
import type { HandlerContext } from './context'

export function registerKeyArtHandlers(ctx: HandlerContext): void {
  const { reg, keyArt, generation, activity } = ctx

  reg('keyArt:get', async (storyId: string) => {
    if (!storyId?.trim()) {
      throw new AppError('VALIDATION', 'errors.storyIdRequired')
    }
    return keyArt().getWithShots(storyId.trim())
  })

  reg(
    'keyArt:update',
    async (
      storyId: string,
      data: {
        title?: string | null
        artStyle?: string | null
        hardRules?: string | null
        pageFormat?: string | null
      }
    ) => keyArt().updateBook(storyId, data)
  )

  reg(
    'keyArt:addShot',
    async (
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
    ) => keyArt().addShot(storyId, input)
  )

  reg(
    'keyArt:updateShot',
    async (
      shotId: string,
      data: {
        shotType?: string | null
        makeMethod?: string | null
        pageFormat?: string | null
        artStyle?: string | null
        brief?: string | null
        characterIds?: string[] | null
        sceneId?: string | null
        timelineEntryId?: string | null
        comicPageId?: string | null
        hardRules?: string | null
      }
    ) => {
      if (!shotId?.trim()) {
        throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
      }
      return keyArt().updateShot(shotId.trim(), data)
    }
  )

  reg('keyArt:deleteShot', async (shotId: string) => {
    if (!shotId?.trim()) {
      throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    }
    const r = await keyArt().deleteShot(shotId.trim())
    const store = generation().getMediaStore()
    const images = parseKeyArtShotImages(r.imageGalleryJson, {
      imagePath: r.imagePath
    })
    for (const path of [r.imagePath, ...images.map((v) => v.path)]) {
      if (!path) continue
      try {
        store.deleteIfExists(path)
      } catch {
        /* ignore */
      }
    }
    return { ok: true as const }
  })

  reg('keyArt:deleteShotImage', async (shotId: string, imageId: string) => {
    if (!shotId?.trim()) {
      throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    }
    if (!imageId?.trim()) {
      throw new AppError('VALIDATION', 'errors.keyArtImageNotFound')
    }
    const r = await keyArt().deleteShotImage(shotId.trim(), imageId.trim())
    try {
      generation().getMediaStore().deleteIfExists(r.removedPath)
    } catch {
      /* ignore */
    }
    return r
  })

  reg('keyArt:setShotImagePrimary', async (shotId: string, imageId: string) => {
    if (!shotId?.trim()) {
      throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    }
    if (!imageId?.trim()) {
      throw new AppError('VALIDATION', 'errors.keyArtImageNotFound')
    }
    return keyArt().setShotImagePrimary(shotId.trim(), imageId.trim())
  })

  reg('keyArt:setAsStoryCover', async (shotId: string) => {
    if (!shotId?.trim()) {
      throw new AppError('VALIDATION', 'errors.keyArtShotIdRequired')
    }
    const r = await keyArt().setAsStoryCover(shotId.trim())
    activity.append({
      kind: 'media',
      level: 'info',
      message: 'keyArtSetCover',
      meta: { shotId: shotId.trim(), storyId: r.storyId }
    })
    return r
  })
}
