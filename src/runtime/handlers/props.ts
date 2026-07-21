/**
 * Domain IPC handlers (split for maintainability).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, join } from 'path'
import { GrokCliClient } from '../../infrastructure/ai/GrokCliClient'
import {
  AppDataBackupService,
  CharacterService,
  CostumeService,
  defaultFullBackupFileName,
  DemoSeedService,
  GenerationService,
  ProjectBackupService,
  PropService,
  ActionService,
  SceneService,
  StoryCastService,
  StoryService,
  TimelinePersistenceService
} from '../../application/services'
import { MediaStore } from '../../infrastructure/media/MediaStore'
import { ActivityLog } from '../../infrastructure/activity/ActivityLog'
import {
  redactSettings,
  supportReportPath,
  writeSupportReportJson
} from '../../infrastructure/support/SupportReport'
import {
  detectInstallChannel,
  githubReleaseUrl
} from '../../domain/installChannel'
import { ensureHardRules } from '../../domain/promptHardRules'
import {
  NPM_INSTALL_CMD,
  NPM_PACKAGE_NAME,
  checkNpmPackageUpdate
} from '../../infrastructure/update/npmPackageUpdate'
import type {
  CreateCharacterInput,
  CreateActionInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  PropProfileFields,
  SceneProfileFields,
  UpdateActionInput,
  UpdateCharacterInput,
  UpdatePropInput,
  UpdateSceneInput,
  UpdateTimelineEntryInput
} from '../../types/domain'
import { chatContentText } from '../../types/domain'
import { SoulMdHubClient } from '../../infrastructure/soulmd/SoulMdHubClient'
import {
  buildCharacterIntroVideoPrompt,
  buildCharacterMasterSystemPrompt,
  buildCharacterMasterUserPrompt,
  buildCharacterSheetEditPrompt,
  buildCharacterSheetImagePrompt,
  extractCharacterProfileJson
} from '../../domain/characterMasterPrompt'
import { buildSceneIntroVideoPrompt } from '../../domain/sceneMasterPrompt'
import { buildPropIntroVideoPrompt } from '../../domain/propMasterPrompt'
import { buildCostumeIntroVideoPrompt } from '../../domain/costumeSwap'
import {
  buildSoulGenerateSystemPrompt,
  buildSoulGenerateUserPrompt,
  normalizeSoulMarkdown,
  profileHasSoulSource
} from '../../domain/soulGenerate'
import {
  appendGalleryItem,
  MAX_IMAGE_EDIT_REFERENCES,
  parseCharacterGallery,
  primaryGalleryPath,
  serializeCharacterGallery,
  setGalleryIntroVideo
} from '../../domain/characterGallery'
import type { AppSettings } from '../../types/settings'
import { AppError } from '../../types/errors'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  isSoulMdPath,
  parseSoulMd
} from '../../domain/character'
import type { OpenDialogOptionsLike } from '../HandlerHost'
import type { HandlerContext } from './context'

export function registerPropsHandlers(ctx: HandlerContext): void {
  const {
    reg,
    host,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    timeline,
    generation,
    rebindAi,
    mediaRoot,
    activity,
    userDataPath,
    settingsStore
  } = ctx

// ─── Props ─────────────────────────────────────────────────
reg(
  'props:list',
  (
    async (
      storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => {
      if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
        return props().listForStory(storyIdOrOpts)
      }
      if (
        storyIdOrOpts &&
        typeof storyIdOrOpts === 'object' &&
        storyIdOrOpts.forStory &&
        storyIdOrOpts.storyId
      ) {
        return props().listForStory(storyIdOrOpts.storyId)
      }
      const q =
        storyIdOrOpts && typeof storyIdOrOpts === 'object'
          ? storyIdOrOpts.q
          : undefined
      return props().list({ q })
    }
  )
)
reg(
  'props:create',
  (async ( input: CreatePropInput) => props().create(input))
)
reg(
  'props:update',
  (async ( id: string, data: UpdatePropInput) => props().update(id, data))
)
reg(
  'props:delete',
  (async ( id: string) => props().delete(id))
)

reg(
  'props:aiFill',
  (
    async (
      payload: {
        idea?: string
        storyId?: string
        locale?: 'zh-HK' | 'en'
        existingDraft?: Record<string, string | undefined | null>
        /** Gallery / external still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
      }
    ) => {
      const {
        buildPropMasterSystemPrompt,
        buildPropMasterUserPrompt,
        extractPropProfileJson
      } = await import('../domain/propMasterPrompt')
      const {
        buildVisionUserContent,
        resolveReadableImagePath,
        visionFillUserPreamble
      } = await import('../domain/chatVision')
      const locale = payload.locale ?? 'zh-HK'
      const draft = payload.existingDraft
      const hasDraft = Boolean(
        draft &&
          Object.values(draft).some((v) => typeof v === 'string' && v.trim())
      )
      const idea = payload.idea?.trim() ?? ''
      const refPath = resolveReadableImagePath(payload.referenceImagePath)
      const hasImage = Boolean(refPath)
      if (!idea && !hasDraft && !hasImage) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrImageRequired'
        )
      }
      // Pure invent-from-idea: skip active story style (Demo rain etc.)
      const { shouldInjectStoryContext } = await import(
        '../domain/storyContextPolicy'
      )
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      if (
        payload.storyId &&
        shouldInjectStoryContext({ hasDraft })
      ) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: payload.storyId }
        })
        storyTitle = story?.title
        styleNote = story?.styleNote
      }
      const ideaForPrompt =
        idea ||
        (hasImage
          ? locale === 'en'
            ? 'Describe and invent a full prop profile from the attached reference photo.'
            : '請根據附上的參考圖，完整填寫道具資料。'
          : locale === 'en'
            ? 'Polish'
            : '全面潤飾')
      const textPrompt = [
        hasImage ? visionFillUserPreamble(locale, 'prop') : null,
        buildPropMasterUserPrompt({
          idea: ideaForPrompt,
          storyTitle,
          styleNote,
          locale,
          existingDraft: (hasDraft
            ? {
                name: draft?.name ?? undefined,
                description: draft?.description ?? undefined,
                material: draft?.material ?? undefined,
                sizeNotes: draft?.sizeNotes ?? undefined,
                condition: draft?.condition ?? undefined,
                visualTags: draft?.visualTags ?? undefined,
                artStyle: draft?.artStyle ?? undefined
              }
            : null) as Partial<PropProfileFields> | null
        })
      ]
        .filter(Boolean)
        .join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildPropMasterSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 1500
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractPropProfileJson(text)
      const { fillMissingProfileFields } = await import(
        '../domain/profileFillMissing'
      )
      const { PROP_PROFILE_JSON_KEYS } = await import(
        '../domain/propMasterPrompt'
      )
      const propRequired = PROP_PROFILE_JSON_KEYS.filter(
        (k) => k !== 'artStyle' && k !== 'hardRules'
      )
      const propPatch = await fillMissingProfileFields({
        profile: profile as unknown as Record<string, unknown>,
        requiredKeys: propRequired,
        locale,
        chat: (req) => ctx.aiClient.chat(req),
        referenceImagePath: refPath,
        maxTokens: 900
      })
      profile = propPatch.profile as unknown as typeof profile
      const propRaw = propPatch.raw
        ? `${text}\n---missing-fill---\n${propPatch.raw}`
        : text
      activity.append({
        kind: 'prop',
        message: hasImage
          ? 'aiFillPropFromImage'
          : hasDraft
            ? 'aiRefineProp'
            : 'aiFillProp',
        storyId: payload.storyId,
        meta: {
          name: profile.name,
          usedImage: hasImage,
          patchedKeys: propPatch.patchedKeys
        }
      })
      return {
        profile,
        profileJson: JSON.stringify(profile, null, 2),
        raw: propRaw
      }
    }
  )
)

reg(
  'props:generatePlate',
  (
    async (
      payload: {
        propId: string
        variant?: string
        referenceImagePath?: string | null
        /** Multi-select identity stills; first path is edit base */
        referenceImagePaths?: string[] | null
        useIdentityEdit?: boolean
        persist?: boolean
        artStyle?: string | null
        /** User-edited prompt from confirm modal */
        promptOverride?: string | null
      }
    ) => {
      const row = await props().get(payload.propId)
      const {
        buildPropPlateEditPrompt,
        buildPropPlateImagePrompt,
        getPropPlateVariant
      } = await import('../domain/propPlateVariants')
      const { getArtStyle } = await import(
        '../domain/characterArtStyles'
      )
      const { resolveSheetGenMode } = await import(
        '../domain/characterMasterPrompt'
      )
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../domain/sceneGallery')
      const {
        aspectFromImageSize,
        imageSizeForPropPlate
      } = await import('../types/settings')
      const {
        allRefPaths,
        appendMultiRefNote,
        pickPrimaryRefPath
      } = await import('../domain/imageGenConfirm')

      const variantDef = getPropPlateVariant(payload.variant)
      const variant = variantDef.id
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      const size = imageSizeForPropPlate(ctx.settings, variant)
      const aspectRatio = aspectFromImageSize(size)
      const profile = {
        name: row.name,
        description: row.description,
        material: row.material ?? undefined,
        sizeNotes: row.sizeNotes ?? undefined,
        condition: row.condition ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
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
          ? buildPropPlateEditPrompt(profile, variant, artStyle)
          : buildPropPlateImagePrompt(profile, variant, artStyle))
      if (!override && refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, 'en')
      }
      prompt = ensureHardRules(prompt, profile.hardRules ?? row.hardRules)
      if (payload.artStyle || row.artStyle !== artStyle) {
        await props().update(row.id, { artStyle })
      }
      const img = usedEdit
        ? await ctx.aiClient.editImage({
            prompt,
            imagePath: validPrimary!,
            size,
            aspectRatio
          })
        : await ctx.aiClient.generateImage({ prompt, size, aspectRatio })
      const store = generation().getMediaStore()
      const persist = payload.persist === true
      let outPath: string
      if (persist) {
        store.ensureLibraryDirs()
        outPath = store.propImagePath(row.id,
          `plate_${variant}`,
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath(`prop_${variant}`, '.png')
      }
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
      const { enhanceCharacterImage } = await import(
        '../infrastructure/media/imageEnhance'
      )
      const enhanced = enhanceCharacterImage(outPath, {
        enabled: ctx.settings.imageEnhance,
        maxEdge: ctx.settings.imageEnhanceMaxEdge,
        scale: ctx.settings.imageEnhanceScale
      })
      const label = variantDef.galleryLabel
      if (!persist) {
        activity.append({
          kind: 'prop',
          message: 'generatePropPlateDraft',
          storyId: undefined,
          meta: { propId: row.id, path: outPath, variant }
        })
        return {
          prop: row,
          path: outPath,
          draft: true,
          label,
          variant,
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
        layer: 'detail'
      })
      const primary = primarySceneGalleryPath(nextGallery)
      const updated = await props().update(row.id, {
        refImagePath: primary,
        refGalleryJson: serializeSceneGallery(nextGallery),
        artStyle
      })
      activity.append({
        kind: 'prop',
        message: 'generatePropPlate',
        storyId: undefined,
        meta: { propId: row.id, path: outPath, variant }
      })
      return {
        prop: updated,
        path: outPath,
        draft: false,
        label,
        variant,
        artStyle,
        usedEdit,
        enhance: enhanced,
        gallery: nextGallery
      }
    }
  )
)

/**
 * Image → prop intro / hero video for one gallery still.
 * Uses prop bible; object identity locked to the source still.
 */
reg(
  'props:generateIntroVideo',
  (
    async (
      payload: {
        propId: string
        sourceImagePath: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const row = await props().get(payload.propId)
      const sourceImagePath = payload.sourceImagePath?.trim()
      if (!sourceImagePath || !existsSync(sourceImagePath)) {
        throw new AppError(
          'VALIDATION',
          'errors.sourceImageRequired',
          'Select a reference still first'
        )
      }
      if (!ctx.aiClient.generateVideo) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'errors.videoUnavailable',
          'Enable Grok gateway videoApi and use a key with agent/admin mode'
        )
      }

      const profile = {
        name: row.name,
        description: row.description || row.name,
        material: row.material ?? undefined,
        sizeNotes: row.sizeNotes ?? undefined,
        condition: row.condition ?? undefined,
        visualTags: row.visualTags ?? undefined,
        artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
      }
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const fallbackPrompt = buildPropIntroVideoPrompt(profile, locale)
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const outPath = store.propVideoPath(row.id, 'intro', '.mp4')
      const seconds =
        typeof payload.durationSeconds === 'number'
          ? payload.durationSeconds
          : 10
      const aspectRatio =
        ctx.settings.aspectRatio === '9:16' || ctx.settings.aspectRatio === '16:9'
          ? ctx.settings.aspectRatio
          : '16:9'

      const {
        polishThenGenerateVideo
      } = await import('../application/video/polishVideoPrompt')
      const {
        buildPropIntroVideoPolishUserPrompt
      } = await import('../domain/videoPromptPolish')

      const propHardRules = row.hardRules ?? null
      const result = await polishThenGenerateVideo({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        hardRules: propHardRules,
        polishUserContent: buildPropIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: true,
          fallbackPrompt,
          name: profile.name,
          description: profile.description,
          material: profile.material,
          sizeNotes: profile.sizeNotes,
          condition: profile.condition,
          visualTags: profile.visualTags,
          artStyle: profile.artStyle,
          seedPrompt:
            (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          hardRules: propHardRules
        }),
        videoRequest: {
          durationSeconds: seconds,
          refImagePath: sourceImagePath,
          outputPath: outPath,
          aspectRatio
        }
      })

      const {
        parseSceneGallery,
        serializeSceneGallery,
        setSceneGalleryIntroVideo
      } = await import('../domain/sceneGallery')
      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const nextGallery = setSceneGalleryIntroVideo(
        gallery,
        sourceImagePath,
        result.outputPath
      )
      const updated = await props().update(row.id, {
        refGalleryJson: serializeSceneGallery(nextGallery)
      })
      activity.append({
        kind: 'prop',
        message: 'generateIntroVideo',
        meta: {
          propId: row.id,
          sourceImagePath,
          path: result.outputPath,
          seconds,
          degraded: result.degraded ?? false,
          polished: result.polished,
          promptPreview: result.promptUsed.slice(0, 200)
        }
      })
      return {
        prop: updated,
        path: result.outputPath,
        sourceImagePath,
        gallery: nextGallery,
        jobId: result.jobId,
        degraded: result.degraded,
        polished: result.polished
      }
    }
  )
)

reg(
  'props:commitPlate',
  (
    async (
      payload: {
        propId: string
        path: string
        variant?: string
        label?: string
      }
    ) => {
      const row = await props().get(payload.propId)
      if (!payload.path || !existsSync(payload.path)) {
        throw new AppError('NOT_FOUND', 'errors.draftNotFound')
      }
      const store = generation().getMediaStore()
      const finalPath = store.promoteTmpPropImage(
        null,
        row.id,
        payload.path,
        `plate_${payload.variant ?? 'hero'}`
      )
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../domain/sceneGallery')
      const gallery = parseSceneGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const nextGallery = appendSceneGalleryItem(gallery, {
        path: finalPath,
        kind: 'sheet',
        label: payload.label ?? 'Prop plate',
        layer: 'detail'
      })
      const primary = primarySceneGalleryPath(nextGallery)
      const updated = await props().update(row.id, {
        refImagePath: primary,
        refGalleryJson: serializeSceneGallery(nextGallery)
      })
      activity.append({
        kind: 'prop',
        message: 'commitPropPlate',
        storyId: undefined,
        meta: { propId: row.id, path: finalPath }
      })
      return { prop: updated, path: finalPath, gallery: nextGallery }
    }
  )
)

}
