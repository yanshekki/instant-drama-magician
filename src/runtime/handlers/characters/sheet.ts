/**
 * registerCharactersSheet
 *
 * @deprecated UI production path: mediaGen:extract → polish → generateImage
 * (kind=character-sheet) + characters:commitSheet.
 * generateSheet remains for CLI / tests / low-level tooling.
 */
import { existsSync, writeFileSync } from 'fs'
import type { HandlerContext } from '../context'
import { AppError } from '../../../types/errors'
import { ensureHardRules } from '../../../domain/promptHardRules'
import { buildCharacterSheetEditPrompt, buildCharacterSheetImagePrompt } from '../../../domain/characterMasterPrompt'
import {
  appendGalleryItem,
  MAX_IMAGE_EDIT_REFERENCES,
  parseCharacterGallery,
  primaryGalleryPath,
  serializeCharacterGallery
} from '../../../domain/characterGallery'

export function registerCharactersSheet(ctx: HandlerContext): void {
  const {
    reg,
    characters,
    generation,
    activity
  } = ctx

/** @deprecated Prefer mediaGen character-sheet pipeline. */
reg(
  'characters:generateSheet',
  (
    async (
      payload: {
        characterId: string
        variant?: string
        /** Prefer this gallery path as edit reference (still capped by API). */
        referenceImagePath?: string | null
        /** Multi-select identity stills; first path is edit base */
        referenceImagePaths?: string[] | null
        /**
         * When false (default for UI), write draft under media/tmp and do not
         * update Character — user confirms via commitSheet.
         */
        persist?: boolean
        /** Visual art style id (photo_cinematic, anime_modern, …) */
        artStyle?: string | null
        /**
         * When true, image_edit with identity ref.
         * When false/omit, pure generateImage so sheet layout can change freely.
         */
        useIdentityEdit?: boolean
        /** Full prompt override from confirm modal */
        promptOverride?: string | null
      }
    ) => {
      const row = await characters().get(payload.characterId)
      const persist = payload.persist === true
      const profile = {
        name: row.name,
        description: row.description,
        appearance: row.appearance ?? undefined,
        personality: row.personality ?? undefined,
        costume: row.costume ?? undefined,
        ageRange: row.ageRange ?? undefined,
        gender: row.gender ?? undefined,
        voiceDesc: row.voiceDesc ?? undefined,
        mannerisms: row.mannerisms ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const { getSheetVariant } = await import('../../../domain/characterSheetVariants')
      const { getArtStyle } = await import('../../../domain/characterArtStyles')
      const { resolveSheetGenMode } = await import('../../../domain/characterMasterPrompt')
      const { allRefPaths, appendMultiRefNote, pickPrimaryRefPath } =
        await import('../../../domain/imageGenConfirm')
      const variantDef = getSheetVariant(payload.variant)
      const variant = variantDef.id
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      // Sizes / enhance from Settings (all have defaults)
      const {
        aspectFromImageSize,
        imageSizeForSheetVariant
      } = await import('../../../types/settings')
      const size = imageSizeForSheetVariant(ctx.settings, variant)
      const aspectRatio = aspectFromImageSize(size)

      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      // Body / base / bare packages: never image_edit — clothed refs clone old sheets.
      const forcePureLayout =
        variantDef.wardrobeLayer === 'nude' ||
        variantDef.wardrobeLayer === 'base' ||
        Boolean(variantDef.requiresUnclothedSupport)
      const refList = allRefPaths(
        payload.referenceImagePath,
        payload.referenceImagePaths
      ).filter((p) => existsSync(p))
      const identityPrimary =
        !forcePureLayout
          ? pickPrimaryRefPath(payload.referenceImagePath, refList)
          : null
      const refPath =
        identityPrimary && existsSync(identityPrimary)
          ? identityPrimary
          : null
      const hasValidRef = Boolean(refPath)
      const usedEdit =
        !forcePureLayout &&
        resolveSheetGenMode({
          useIdentityEdit: payload.useIdentityEdit,
          hasValidRef
        }) === 'edit'
      const override =
        typeof payload.promptOverride === 'string' &&
        payload.promptOverride.trim()
          ? payload.promptOverride.trim()
          : null
      let prompt =
        override ??
        (usedEdit
          ? buildCharacterSheetEditPrompt(profile, variant, artStyle)
          : buildCharacterSheetImagePrompt(profile, variant, artStyle))
      if (!override && refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, 'en')
      }
      prompt = ensureHardRules(prompt, profile.hardRules ?? row.hardRules)

      // Persist style before long gen so reload/UI stay in sync
      if (payload.artStyle || row.artStyle !== artStyle) {
        await characters().update(row.id, { artStyle })
      }

      const img = usedEdit
        ? await ctx.aiClient.editImage({
            prompt,
            imagePath: refPath!,
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
        outPath = store.characterImagePath(row.id,
          `sheet_${variant}`,
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath(`sheet_${variant}`, '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))

      // Grok native ~720p/1k; optional 2× Lanczos+unsharp (Settings → Photo)
      const { enhanceCharacterImage } = await import('../../../infrastructure/media/imageEnhance')
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })

      const label = variantDef.galleryLabel

      if (!persist) {
        activity.append({
          kind: 'character',
          message: 'generateSheetDraft',
          storyId: undefined,
          meta: {
            characterId: row.id,
            path: outPath,
            size: img.sizeUsed,
            aspect: img.aspectUsed,
            usedEdit,
            enhance: enhanced
          }
        })
        // Remember last art style even for drafts
        if (payload.artStyle) {
          await characters().update(row.id, { artStyle })
        }
        return {
          character: row,
          path: outPath,
          size: img.sizeUsed,
          aspect: img.aspectUsed,
          gallery: gallery,
          usedEdit,
          referencePath: usedEdit ? refPath : null,
          enhance: enhanced,
          draft: true,
          label,
          variant,
          artStyle,
          layer: variantDef.wardrobeLayer
        }
      }

      const nextGallery = appendGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: variantDef.wardrobeLayer
      })
      const coverPath = primaryGalleryPath(nextGallery)
      const updated = await characters().update(row.id, {
        refSheetPath: outPath,
        refImagePath: coverPath,
        refGalleryJson: serializeCharacterGallery(nextGallery),
        artStyle
      })
      activity.append({
        kind: 'character',
        message: 'generateSheet',
        storyId: undefined,
        meta: {
          characterId: row.id,
          path: outPath,
          size: img.sizeUsed,
          aspect: img.aspectUsed,
          gallery: nextGallery.length,
          usedEdit,
          refPath: usedEdit ? refPath : null,
          refCap: MAX_IMAGE_EDIT_REFERENCES,
          enhance: enhanced,
          artStyle,
          layer: variantDef.wardrobeLayer
        }
      })
      return {
        character: updated,
        path: outPath,
        size: img.sizeUsed,
        aspect: img.aspectUsed,
        gallery: nextGallery,
        usedEdit,
        referencePath: usedEdit ? refPath : null,
        enhance: enhanced,
        draft: false,
        label,
        variant,
        artStyle,
        layer: variantDef.wardrobeLayer
      }
    }
  )
)

/**
 * Image → self-intro video for one gallery still.
 * Uses full character bible in the prompt; identity locked to the source image.
 */

reg(
  'characters:commitSheet',
  (
    async (
      payload: {
        characterId: string
        path: string
        variant?: string
        label?: string
        layer?: string
        /** When set, also update Character.costume after commit (costume-swap). */
        costumeDescription?: string | null
      }
    ) => {
      const row = await characters().get(payload.characterId)
      if (!payload.path || !existsSync(payload.path)) {
        throw new AppError('NOT_FOUND', 'errors.draftNotFound')
      }
      const store = generation().getMediaStore()
      const kind = `sheet_${payload.variant ?? 'bible'}`
      const finalPath = store.promoteTmpImage(
        null,
        row.id,
        payload.path,
        kind
      )
      const gallery = parseCharacterGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath,
        refSheetPath: row.refSheetPath
      })
      const { getSheetVariant, isSheetVariantId } = await import('../../../domain/characterSheetVariants')
      const knownLayers = new Set([
        'identity',
        'nude',
        'base',
        'costume',
        'detail'
      ])
      const explicitLayer =
        typeof payload.layer === 'string' && knownLayers.has(payload.layer)
          ? (payload.layer as
              | 'identity'
              | 'nude'
              | 'base'
              | 'costume'
              | 'detail')
          : undefined
      const variantLayer =
        payload.variant === 'costume_swap'
          ? ('costume' as const)
          : isSheetVariantId(payload.variant)
            ? getSheetVariant(payload.variant).wardrobeLayer
            : undefined
      const layer = explicitLayer ?? variantLayer
      const nextGallery = appendGalleryItem(gallery, {
        path: finalPath,
        kind: 'sheet',
        label: payload.label ?? 'Sheet',
        ...(layer ? { layer } : {})
      })
      const primary = primaryGalleryPath(nextGallery)
      const costumeText =
        typeof payload.costumeDescription === 'string'
          ? payload.costumeDescription.trim()
          : ''
      let costumesJsonPatch: { costumesJson?: string } = {}
      if (costumeText) {
        const {
          ensureCostumeInLibrary,
          parseCharacterCostumes,
          serializeCharacterCostumes,
          upsertCostume,
          createCostumeEntry
        } = await import('../../../domain/characterCostumes')
        let lib = parseCharacterCostumes(
          (row as { costumesJson?: string | null }).costumesJson
        )
        lib = ensureCostumeInLibrary(lib, costumeText, {
          name: payload.label?.replace(/^Costume swap ·\s*/i, '') || 'Look'
        })
        // Link latest dress image to matching costume entry
        const hit = lib.find(
          (c) =>
            c.description.trim().toLowerCase() === costumeText.toLowerCase()
        )
        if (hit) {
          lib = upsertCostume(lib, {
            ...hit,
            imagePath: finalPath,
            updatedAt: new Date().toISOString()
          })
        } else {
          lib = [
            createCostumeEntry({
              name: 'Look',
              description: costumeText,
              imagePath: finalPath
            }),
            ...lib
          ]
        }
        costumesJsonPatch = {
          costumesJson: serializeCharacterCostumes(lib)
        }
      }
      const costumePatch = costumeText ? { costume: costumeText } : {}
      const updated = await characters().update(row.id, {
        refSheetPath: finalPath,
        refImagePath: primary,
        refGalleryJson: serializeCharacterGallery(nextGallery),
        ...costumePatch,
        ...costumesJsonPatch
      })
      activity.append({
        kind: 'character',
        message: 'commitSheet',
        storyId: undefined,
        meta: {
          characterId: row.id,
          path: finalPath,
          layer: layer ?? null,
          costumeUpdated: Boolean(costumeText)
        }
      })
      return {
        character: updated,
        path: finalPath,
        gallery: nextGallery
      }
    }
  )
)

/**
 * Costume swap: image_edit on a body/base/costume base with a new wardrobe
 * description. Writes a draft under media/tmp unless persist=true.
 */

reg(
  'media:discardSheetDraft',
  (async ( filePath: string) => {
    const store = generation().getMediaStore()
    store.discardTmp(filePath)
    return { ok: true as const }
  })
)
}
