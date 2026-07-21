/**
 * registerScenesPlate
 */
import { existsSync, writeFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import { ensureHardRules } from '../../../domain/promptHardRules'

export function registerScenesPlate(ctx: HandlerContext): void {
  const {
    reg,
    scenes,
    generation,
    activity
  } = ctx

reg(
  'scenes:generatePlate',
  (
    async (
      payload: {
        sceneId: string
        variant?: string
        referenceImagePath?: string | null
        referenceImagePaths?: string[] | null
        useIdentityEdit?: boolean
        persist?: boolean
        artStyle?: string | null
        promptOverride?: string | null
      }
    ) => {
      const row = await scenes().get(payload.sceneId)
      const persist = payload.persist === true
      const {
        buildScenePlateEditPrompt,
        buildScenePlateImagePrompt,
        getScenePlateVariant
      } = await import('../../../domain/scenePlateVariants')
      const { getArtStyle } = await import('../../../domain/characterArtStyles')
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../../../domain/sceneGallery')
      const {
        aspectFromImageSize,
        imageSizeForScenePlate
      } = await import('../../../types/settings')

      const variantDef = getScenePlateVariant(payload.variant)
      const variant = variantDef.id
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const size = imageSizeForScenePlate(ctx.settings, variant)
      const aspectRatio = aspectFromImageSize(size)
      const profile = {
        title: row.title ?? undefined,
        description: row.description,
        locationType: row.locationType ?? undefined,
        timeOfDay: row.timeOfDay ?? undefined,
        weather: row.weather ?? undefined,
        mood: row.mood ?? undefined,
        lighting: row.lighting ?? undefined,
        colorPalette: row.colorPalette ?? undefined,
        setDressing: row.setDressing ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const { allRefPaths, appendMultiRefNote, pickPrimaryRefPath } =
        await import('../../../domain/imageGenConfirm')
      const refList = allRefPaths(
        payload.referenceImagePath,
        payload.referenceImagePaths
      ).filter((p) => existsSync(p))
      const refPath = pickPrimaryRefPath(
        payload.referenceImagePath,
        refList
      )
      const validPrimary =
        refPath && existsSync(refPath) ? refPath : null
      const { resolveSheetGenMode } = await import('../../../domain/characterMasterPrompt')
      const usedEdit =
        resolveSheetGenMode({
          useIdentityEdit: payload.useIdentityEdit,
          hasValidRef: Boolean(validPrimary)
        }) === 'edit'
      const override =
        typeof payload.promptOverride === 'string' &&
        payload.promptOverride.trim()
          ? payload.promptOverride.trim()
          : null
      let prompt =
        override ??
        (usedEdit
          ? buildScenePlateEditPrompt(profile, variant, artStyle)
          : buildScenePlateImagePrompt(profile, variant, artStyle))
      if (!override && refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, 'en')
      }
      prompt = ensureHardRules(prompt, profile.hardRules ?? row.hardRules)

      if (payload.artStyle || row.artStyle !== artStyle) {
        await scenes().update(row.id, { artStyle })
      }

      const img = usedEdit
        ? await ctx.aiClient.editImage({
            prompt,
            imagePath: validPrimary!,
            size,
            aspectRatio
          })
        : await ctx.aiClient.generateImage({
            prompt,
            size,
            aspectRatio
          })

      const store = generation().getMediaStore()
      let outPath: string
      if (persist) {
        store.ensureLibraryDirs()
        outPath = store.sceneImagePath(row.id,
          `plate_${variant}`,
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath(`scene_${variant}`, '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
      const { enhanceCharacterImage } = await import('../../../infrastructure/media/imageEnhance')
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })
      const label = variantDef.galleryLabel

      if (!persist) {
        activity.append({
          kind: 'scene',
          message: 'generatePlateDraft',
          storyId: undefined,
          meta: {
            sceneId: row.id,
            path: outPath,
            variant,
            artStyle,
            usedEdit
          }
        })
        return {
          scene: row,
          path: outPath,
          draft: true,
          label,
          variant,
          layer: variantDef.plateLayer,
          artStyle,
          usedEdit,
          enhance: enhanced,
          gallery
        }
      }

      const nextGallery = appendSceneGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: variantDef.plateLayer
      })
      const primary = primarySceneGalleryPath(nextGallery)
      const updated = await scenes().update(row.id, {
        refImagePath: primary,
        refGalleryJson: serializeSceneGallery(nextGallery),
        artStyle
      })
      activity.append({
        kind: 'scene',
        message: 'generatePlate',
        storyId: undefined,
        meta: { sceneId: row.id, path: outPath, variant, artStyle }
      })
      return {
        scene: updated,
        path: outPath,
        draft: false,
        label,
        variant,
        layer: variantDef.plateLayer,
        artStyle,
        usedEdit,
        enhance: enhanced,
        gallery: nextGallery
      }
    }
  )
)

/**
 * Image → location intro / establishing video for one gallery still.
 * Uses full scene location bible in the prompt; space locked to the source plate.
 */

reg(
  'scenes:commitPlate',
  (
    async (
      payload: {
        sceneId: string
        path: string
        variant?: string
        label?: string
        layer?: string
        atmosphereDescription?: string | null
      }
    ) => {
      const row = await scenes().get(payload.sceneId)
      if (!payload.path || !existsSync(payload.path)) {
        throw new AppError('NOT_FOUND', 'errors.draftNotFound')
      }
      const store = generation().getMediaStore()
      const kind = `plate_${payload.variant ?? 'establishing'}`
      const finalPath = store.promoteTmpSceneImage(
        null,
        row.id,
        payload.path,
        kind
      )
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../../../domain/sceneGallery')
      const { getScenePlateVariant, isScenePlateVariantId } = await import('../../../domain/scenePlateVariants')
      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const layer =
        payload.layer ||
        (payload.variant === 'atmosphere_swap'
          ? 'atmosphere'
          : isScenePlateVariantId(payload.variant)
            ? getScenePlateVariant(payload.variant).plateLayer
            : undefined)
      const nextGallery = appendSceneGalleryItem(gallery, {
        path: finalPath,
        kind: 'sheet',
        label: payload.label ?? 'Plate',
        ...(layer ? { layer } : {})
      })
      const primary = primarySceneGalleryPath(nextGallery)
      let looksPatch: { looksJson?: string } = {}
      const atmo = payload.atmosphereDescription?.trim()
      if (atmo) {
        const {
          ensureLookInLibrary,
          parseSceneLooks,
          serializeSceneLooks,
          upsertSceneLook
        } = await import('../../../domain/sceneLooks')
        let looks = parseSceneLooks(row.looksJson)
        looks = ensureLookInLibrary(looks, atmo, {
          name: payload.label?.replace(/^Atmosphere ·\s*/i, '') || 'Look'
        })
        const hit = looks.find(
          (l) => l.description.trim().toLowerCase() === atmo.toLowerCase()
        )
        if (hit) {
          looks = upsertSceneLook(looks, {
            ...hit,
            imagePath: finalPath,
            updatedAt: new Date().toISOString()
          })
        }
        looksPatch = { looksJson: serializeSceneLooks(looks) }
      }
      const updated = await scenes().update(row.id, {
        refImagePath: primary,
        refGalleryJson: serializeSceneGallery(nextGallery),
        ...looksPatch
      })
      activity.append({
        kind: 'scene',
        message: 'commitPlate',
        storyId: undefined,
        meta: { sceneId: row.id, path: finalPath, layer: layer ?? null }
      })
      return { scene: updated, path: finalPath, gallery: nextGallery }
    }
  )
)
}
