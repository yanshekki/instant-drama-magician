/**
 * registerCharactersCostumeSwap
 */
import { existsSync, writeFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import {
  appendGalleryItem,
  parseCharacterGallery,
  primaryGalleryPath,
  serializeCharacterGallery
} from '../../../domain/characterGallery'

export function registerCharactersCostumeSwap(ctx: HandlerContext): void {
  const {
    reg,
    characters,
    generation,
    activity
  } = ctx

reg(
  'characters:swapCostume',
  (
    async (
      payload: {
        characterId: string
        costumeDescription: string
        baseImagePath?: string | null
        artStyle?: string | null
        pose?: string | null
        /** When true, write gallery immediately (tests); UI uses draft. */
        persist?: boolean
        /** Also update Character.costume when persisting. */
        updateCostumeField?: boolean
      }
    ) => {
      const row = await characters().get(payload.characterId)
      const costumeDescription = (payload.costumeDescription ?? '').trim()
      if (!costumeDescription) {
        throw new AppError(
          'VALIDATION',
          'errors.costumeDescRequired'
        )
      }

      const {
        buildCostumeSwapPrompt,
        costumeSwapGalleryLabel,
        getCostumeSwapPose,
        pickBestBaseImage
      } = await import('../../../domain/costumeSwap')
      const { getArtStyle } = await import('../../../domain/characterArtStyles')
      const {
        aspectFromImageSize
      } = await import('../../../types/settings')

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      const existingSwapGallery = gallery.filter(
        (g) => g.path && existsSync(g.path)
      )
      const pickedExisting = pickBestBaseImage(existingSwapGallery, {
        ageRange: row.ageRange,
        preferredPath: payload.baseImagePath
      })
      if (!pickedExisting.item?.path || !existsSync(pickedExisting.item.path)) {
        throw new AppError('VALIDATION', 'errors.costumeSwapNoBase')
      }
      const basePath = pickedExisting.item.path
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const pose = getCostumeSwapPose(payload.pose)
      const prompt = buildCostumeSwapPrompt({
        name: row.name,
        newCostume: costumeDescription,
        artStyle,
        pose: pose.id,
        appearance: row.appearance,
        ageRange: row.ageRange,
        gender: row.gender,
        visualTags: row.visualTags,
        mannerisms: row.mannerisms
      })

      // Pose → image size class
      const size =
        pose.id === 'turnaround'
          ? ctx.settings.imageSizeWide
          : pose.id === 'three_quarter'
            ? ctx.settings.imageSizeSquare
            : ctx.settings.imageSizeTall
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
        outPath = store.characterImagePath(row.id,
          'costume_swap',
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath('costume_swap', '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))

      const { enhanceCharacterImage } = await import('../../../infrastructure/media/imageEnhance')
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })

      const label = costumeSwapGalleryLabel(costumeDescription)

      if (payload.artStyle || row.artStyle !== artStyle) {
        await characters().update(row.id, { artStyle })
      }

      if (!persist) {
        activity.append({
          kind: 'character',
          message: 'swapCostumeDraft',
          storyId: undefined,
          meta: {
            characterId: row.id,
            path: outPath,
            basePath,
            pickReason: pickedExisting.reason,
            costume: costumeDescription.slice(0, 120),
            artStyle,
            pose: pose.id,
            enhance: enhanced
          }
        })
        return {
          character: row,
          path: outPath,
          size: img.sizeUsed,
          aspect: img.aspectUsed,
          gallery,
          basePath,
          pickReason: pickedExisting.reason,
          enhance: enhanced,
          draft: true,
          label,
          variant: 'costume_swap',
          layer: 'costume' as const,
          costumeDescription,
          artStyle,
          pose: pose.id
        }
      }

      const nextGallery = appendGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: 'costume'
      })
      const primary = primaryGalleryPath(nextGallery)
      const updated = await characters().update(row.id, {
        refSheetPath: outPath,
        refImagePath: primary,
        refGalleryJson: serializeCharacterGallery(nextGallery),
        artStyle,
        ...(payload.updateCostumeField !== false
          ? { costume: costumeDescription }
          : {})
      })
      activity.append({
        kind: 'character',
        message: 'swapCostume',
        storyId: undefined,
        meta: {
          characterId: row.id,
          path: outPath,
          basePath,
          pickReason: pickedExisting.reason,
          costume: costumeDescription.slice(0, 120),
          artStyle,
          pose: pose.id,
          enhance: enhanced
        }
      })
      return {
        character: updated,
        path: outPath,
        size: img.sizeUsed,
        aspect: img.aspectUsed,
        gallery: nextGallery,
        basePath,
        pickReason: pickedExisting.reason,
        enhance: enhanced,
        draft: false,
        label,
        variant: 'costume_swap',
        layer: 'costume' as const,
        costumeDescription,
        artStyle,
        pose: pose.id
      }
    }
  )
)
}
