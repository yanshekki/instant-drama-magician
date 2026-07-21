/**
 * registerScenesAtmosphere
 */
import { existsSync, writeFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import { ensureHardRules } from '../../../domain/promptHardRules'

export function registerScenesAtmosphere(ctx: HandlerContext): void {
  const {
    reg,
    scenes,
    generation,
    activity
  } = ctx

reg(
  'scenes:swapAtmosphere',
  (
    async (
      payload: {
        sceneId: string
        atmosphereDescription: string
        baseImagePath?: string | null
        artStyle?: string | null
        pose?: string | null
        persist?: boolean
      }
    ) => {
      const row = await scenes().get(payload.sceneId)
      const atmosphereDescription = (
        payload.atmosphereDescription ?? ''
      ).trim()
      if (!atmosphereDescription) {
        throw new AppError(
          'VALIDATION',
          'errors.atmosphereRequired'
        )
      }
      const {
        buildAtmosphereSwapPrompt,
        atmosphereGalleryLabel,
        getAtmospherePose,
        pickBestSceneBaseImage
      } = await import('../../../domain/sceneAtmosphere')
      const { getArtStyle } = await import('../../../domain/characterArtStyles')
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../../../domain/sceneGallery')
      const { aspectFromImageSize } = await import('../../../types/settings')

      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const picked = pickBestSceneBaseImage(
        gallery,
        payload.baseImagePath
      )
      if (!picked.item?.path || !existsSync(picked.item.path)) {
        throw new AppError(
          'VALIDATION',
          'errors.atmosphereBasePlateRequired'
        )
      }
      const basePath = picked.item.path
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const pose = getAtmospherePose(payload.pose)
      let prompt = buildAtmosphereSwapPrompt({
        title: row.title ?? undefined,
        description: row.description,
        atmosphereDescription,
        artStyle,
        pose: pose.id,
        setDressing: row.setDressing,
        visualTags: row.visualTags,
        hardRules: row.hardRules
      })
      prompt = ensureHardRules(prompt, row.hardRules)
      const size =
        pose.id === 'detail'
          ? ctx.settings.imageSizeSquare
          : ctx.settings.imageSizeWide
      const aspectRatio = aspectFromImageSize(size)
      const img = await ctx.aiClient.editImage({
        prompt,
        imagePath: basePath,
        size,
        aspectRatio
      })
      const store = generation().getMediaStore()
      const persist = payload.persist === true
      let outPath: string
      if (persist) {
        store.ensureLibraryDirs()
        outPath = store.sceneImagePath(row.id,
          'atmosphere_swap',
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath('atmosphere_swap', '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
      const { enhanceCharacterImage } = await import('../../../infrastructure/media/imageEnhance')
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })
      const label = atmosphereGalleryLabel(atmosphereDescription)
      if (payload.artStyle || row.artStyle !== artStyle) {
        await scenes().update(row.id, { artStyle })
      }
      if (!persist) {
        activity.append({
          kind: 'scene',
          message: 'swapAtmosphereDraft',
          storyId: undefined,
          meta: {
            sceneId: row.id,
            path: outPath,
            basePath,
            atmosphere: atmosphereDescription.slice(0, 120)
          }
        })
        return {
          scene: row,
          path: outPath,
          draft: true,
          label,
          variant: 'atmosphere_swap',
          layer: 'atmosphere',
          atmosphereDescription,
          artStyle,
          enhance: enhanced,
          basePath
        }
      }
      const nextGallery = appendSceneGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: 'atmosphere'
      })
      const primary = primarySceneGalleryPath(nextGallery)
      const updated = await scenes().update(row.id, {
        refImagePath: primary,
        refGalleryJson: serializeSceneGallery(nextGallery),
        artStyle
      })
      activity.append({
        kind: 'scene',
        message: 'swapAtmosphere',
        storyId: undefined,
        meta: { sceneId: row.id, path: outPath, basePath }
      })
      return {
        scene: updated,
        path: outPath,
        draft: false,
        label,
        variant: 'atmosphere_swap',
        layer: 'atmosphere',
        atmosphereDescription,
        artStyle,
        enhance: enhanced,
        basePath,
        gallery: nextGallery
      }
    }
  )
)

/** Copy location plates from another scene sharing locationKey (or same title). */
}
