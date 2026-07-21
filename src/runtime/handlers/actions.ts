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

export function registerActionsHandlers(ctx: HandlerContext): void {
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

// ─── Actions (motion direction library) ────────────────────
reg(
  'actions:list',
  (
    async (
      storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => {
      if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
        return actions().listForStory(storyIdOrOpts)
      }
      if (
        storyIdOrOpts &&
        typeof storyIdOrOpts === 'object' &&
        storyIdOrOpts.forStory &&
        storyIdOrOpts.storyId
      ) {
        return actions().listForStory(storyIdOrOpts.storyId)
      }
      const q =
        storyIdOrOpts && typeof storyIdOrOpts === 'object'
          ? storyIdOrOpts.q
          : undefined
      return actions().list({ q })
    }
  )
)
reg('actions:get', async (id: string) => actions().get(id))
reg(
  'actions:create',
  (async (input: CreateActionInput) => actions().create(input))
)
reg(
  'actions:update',
  (async (id: string, data: UpdateActionInput) =>
    actions().update(id, data))
)
reg(
  'actions:delete',
  (async (id: string) => actions().delete(id))
)
reg(
  'actions:linkStory',
  (async (storyId: string, actionId: string) =>
    actions().linkStory(storyId, actionId))
)
reg(
  'actions:unlinkStory',
  (async (storyId: string, actionId: string) =>
    actions().unlinkStory(storyId, actionId))
)

reg(
  'actions:aiFill',
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
        buildActionMasterSystemPrompt,
        buildActionMasterUserPrompt,
        extractActionProfileJson
      } = await import('../domain/actionMasterPrompt')
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
      const { shouldInjectStoryContext } = await import(
        '../domain/storyContextPolicy'
      )
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      if (payload.storyId && shouldInjectStoryContext({ hasDraft })) {
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
            ? 'Describe and invent a full action profile from the attached instruction / reference still.'
            : '請根據附上的參考／指示圖，完整填寫動作資料。'
          : locale === 'en'
            ? 'Polish'
            : '全面潤飾')
      const textPrompt = [
        hasImage ? visionFillUserPreamble(locale, 'action') : null,
        buildActionMasterUserPrompt({
          idea: ideaForPrompt,
          storyTitle,
          styleNote,
          locale,
          existingDraft: hasDraft
            ? {
                name: draft?.name ?? undefined,
                description: draft?.description ?? undefined,
                motionNotes: draft?.motionNotes ?? undefined,
                intention: draft?.intention ?? undefined,
                cameraNotes: draft?.cameraNotes ?? undefined,
                visualTags: draft?.visualTags ?? undefined,
                artStyle: draft?.artStyle ?? undefined
              }
            : null
        })
      ]
        .filter(Boolean)
        .join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildActionMasterSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 1600
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractActionProfileJson(text)
      const { fillMissingProfileFields } = await import(
        '../domain/profileFillMissing'
      )
      const { ACTION_PROFILE_JSON_KEYS } = await import(
        '../domain/actionMasterPrompt'
      )
      const actionRequired = ACTION_PROFILE_JSON_KEYS.filter(
        (k) => k !== 'artStyle' && k !== 'hardRules'
      )
      const actionPatch = await fillMissingProfileFields({
        profile: profile as unknown as Record<string, unknown>,
        requiredKeys: actionRequired,
        locale,
        chat: (req) => ctx.aiClient.chat(req),
        referenceImagePath: refPath,
        maxTokens: 900
      })
      profile = actionPatch.profile as unknown as typeof profile
      const actionRaw = actionPatch.raw
        ? `${text}\n---missing-fill---\n${actionPatch.raw}`
        : text
      activity.append({
        kind: 'action',
        message: hasImage
          ? 'aiFillActionFromImage'
          : hasDraft
            ? 'aiRefineAction'
            : 'aiFillAction',
        storyId: payload.storyId,
        meta: {
          name: profile.name,
          usedImage: hasImage,
          patchedKeys: actionPatch.patchedKeys
        }
      })
      return {
        profile,
        profileJson: JSON.stringify(profile, null, 2),
        raw: actionRaw
      }
    }
  )
)

reg(
  'actions:generatePlate',
  (
    async (
      payload: {
        actionId: string
        panelLayout?: string | null
        referenceImagePath?: string | null
        referenceImagePaths?: string[] | null
        useIdentityEdit?: boolean
        persist?: boolean
        artStyle?: string | null
        promptOverride?: string | null
      }
    ) => {
      const row = await actions().get(payload.actionId)
      const {
        buildActionPlateEditPrompt,
        buildActionPlateImagePrompt
      } = await import('../domain/actionMasterPrompt')
      const { getActionPanelLayout } = await import(
        '../domain/actionPlateVariants'
      )
      const { parseActionCastRefs } = await import(
        '../domain/actionCastRefs'
      )
      const { getArtStyle } = await import('../domain/characterArtStyles')
      const { resolveSheetGenMode } = await import(
        '../domain/characterMasterPrompt'
      )
      const {
        appendActionGalleryItem,
        parseActionGallery,
        primaryActionGalleryPath,
        serializeActionGallery
      } = await import('../domain/actionGallery')
      const { aspectFromImageSize } = await import('../types/settings')

      const layout = getActionPanelLayout(
        payload.panelLayout ?? row.panelLayout
      )
      const artStyle = getArtStyle(
        payload.artStyle ?? row.artStyle ?? undefined
      ).id
      // Match canvas aspect to layout: 2×3 / strips need wide so models
      // don't collapse to a square 2×2 four-panel board.
      const size =
        layout.sizeClass === 'tall'
          ? ctx.settings.imageSizeTall
          : layout.sizeClass === 'square'
            ? ctx.settings.imageSizeSquare
            : ctx.settings.imageSizeWide
      const aspectRatio = aspectFromImageSize(size)
      const profile = {
        name: row.name,
        description: row.description,
        motionNotes: row.motionNotes ?? undefined,
        intention: row.intention ?? undefined,
        cameraNotes: row.cameraNotes ?? undefined,
        visualTags: row.visualTags ?? undefined,
        hardRules: row.hardRules ?? undefined
      }
      const castRefs = parseActionCastRefs(row.castRefsJson)
      const gallery = parseActionGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const { allRefPaths, appendMultiRefNote, pickPrimaryRefPath } =
        await import('../domain/imageGenConfirm')
      const refList = allRefPaths(
        payload.referenceImagePath,
        payload.referenceImagePaths
      ).filter((p) => existsSync(p))
      const primary =
        pickPrimaryRefPath(payload.referenceImagePath, refList) ||
        castRefs[0]?.imagePath ||
        null
      const refPath =
        primary && existsSync(primary) ? primary : null
      const usedEdit =
        resolveSheetGenMode({
          useIdentityEdit: payload.useIdentityEdit ?? Boolean(refPath),
          hasValidRef: Boolean(refPath)
        }) === 'edit'
      const override =
        typeof payload.promptOverride === 'string' &&
        payload.promptOverride.trim()
          ? payload.promptOverride.trim()
          : null
      let prompt =
        override ??
        (usedEdit
          ? buildActionPlateEditPrompt(profile, layout.id, artStyle)
          : buildActionPlateImagePrompt(
              profile,
              layout.id,
              artStyle,
              castRefs
            ))
      if (!override && refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, 'en')
      }
      prompt = ensureHardRules(prompt, profile.hardRules ?? row.hardRules)
      if (payload.artStyle || row.artStyle !== artStyle) {
        await actions().update(row.id, { artStyle })
      }
      if (payload.panelLayout && payload.panelLayout !== row.panelLayout) {
        await actions().update(row.id, { panelLayout: layout.id })
      }
      const img = usedEdit
        ? await ctx.aiClient.editImage({
            prompt,
            imagePath: refPath!,
            size,
            aspectRatio
          })
        : await ctx.aiClient.generateImage({ prompt, size, aspectRatio })
      const store = generation().getMediaStore()
      const persist = payload.persist === true
      let outPath: string
      if (persist) {
        store.ensureLibraryDirs()
        outPath = store.actionImagePath(
          row.id,
          `plate_${layout.id}`,
          '.png'
        )
      } else {
        store.ensureTmpDir()
        outPath = store.tmpImagePath(`action_${layout.id}`, '.png')
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
      const label = layout.galleryLabel
      if (!persist) {
        activity.append({
          kind: 'action',
          message: 'generateActionPlateDraft',
          meta: { actionId: row.id, path: outPath, layout: layout.id }
        })
        return {
          action: row,
          path: outPath,
          draft: true,
          label,
          panelLayout: layout.id,
          artStyle,
          usedEdit,
          enhance: enhanced,
          gallery
        }
      }
      const nextGallery = appendActionGalleryItem(gallery, {
        path: outPath,
        kind: 'sheet',
        label,
        layer: 'detail'
      })
      const coverPath = primaryActionGalleryPath(nextGallery)
      const updated = await actions().update(row.id, {
        refImagePath: coverPath,
        refGalleryJson: serializeActionGallery(nextGallery),
        artStyle,
        panelLayout: layout.id
      })
      activity.append({
        kind: 'action',
        message: 'generateActionPlate',
        meta: { actionId: row.id, path: outPath, layout: layout.id }
      })
      return {
        action: updated,
        path: outPath,
        draft: false,
        label,
        panelLayout: layout.id,
        artStyle,
        usedEdit,
        enhance: enhanced,
        gallery: nextGallery
      }
    }
  )
)

reg(
  'actions:commitPlate',
  (
    async (
      payload: {
        actionId: string
        path: string
        panelLayout?: string
        label?: string
      }
    ) => {
      const row = await actions().get(payload.actionId)
      if (!payload.path || !existsSync(payload.path)) {
        throw new AppError('NOT_FOUND', 'errors.draftNotFound')
      }
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const finalPath = store.actionImagePath(
        row.id,
        `plate_${payload.panelLayout ?? row.panelLayout ?? 'grid'}`,
        extname(payload.path) || '.png'
      )
      copyFileSync(payload.path, finalPath)
      const {
        appendActionGalleryItem,
        parseActionGallery,
        primaryActionGalleryPath,
        serializeActionGallery
      } = await import('../domain/actionGallery')
      const gallery = parseActionGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const nextGallery = appendActionGalleryItem(gallery, {
        path: finalPath,
        kind: 'sheet',
        label: payload.label ?? 'Instruction board',
        layer: 'detail'
      })
      const primary = primaryActionGalleryPath(nextGallery)
      const updated = await actions().update(row.id, {
        refImagePath: primary,
        refGalleryJson: serializeActionGallery(nextGallery)
      })
      activity.append({
        kind: 'action',
        message: 'commitActionPlate',
        meta: { actionId: row.id, path: finalPath }
      })
      return { action: updated, path: finalPath, gallery: nextGallery }
    }
  )
)

reg(
  'actions:generateIntroVideo',
  (
    async (
      payload: {
        actionId: string
        sourceImagePath: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const row = await actions().get(payload.actionId)
      const sourceImagePath = payload.sourceImagePath?.trim()
      if (!sourceImagePath || !existsSync(sourceImagePath)) {
        throw new AppError(
          'VALIDATION',
          'errors.sourceImageRequired',
          'Select an instruction still first'
        )
      }
      if (!ctx.aiClient.generateVideo) {
        throw new AppError(
          'AI_UNAVAILABLE',
          'errors.videoUnavailable',
          'Enable Grok gateway videoApi'
        )
      }
      const profile = {
        name: row.name,
        description: row.description || row.name,
        motionNotes: row.motionNotes ?? undefined,
        intention: row.intention ?? undefined,
        cameraNotes: row.cameraNotes ?? undefined,
        visualTags: row.visualTags ?? undefined,
        artStyle: row.artStyle ?? undefined
      }
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const { buildActionIntroVideoPrompt } = await import(
        '../domain/actionMasterPrompt'
      )
      const fallbackPrompt = buildActionIntroVideoPrompt(profile, locale)
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const outPath = store.actionVideoPath(row.id, 'intro', '.mp4')
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
      const actionHardRules = row.hardRules ?? null
      const {
        hardRulesMaterialsBlock
      } = await import('../domain/videoPromptPolish')
      const result = await polishThenGenerateVideo({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        hardRules: actionHardRules,
        polishUserContent: [
          hardRulesMaterialsBlock(actionHardRules, locale),
          fallbackPrompt
        ]
          .filter(Boolean)
          .join('\n'),
        videoRequest: {
          durationSeconds: seconds,
          refImagePath: sourceImagePath,
          outputPath: outPath,
          aspectRatio
        }
      })
      const {
        parseActionGallery,
        serializeActionGallery,
        setActionGalleryIntroVideo
      } = await import('../domain/actionGallery')
      const gallery = parseActionGallery(row.refGalleryJson, {
        refImagePath: row.refImagePath
      })
      const nextGallery = setActionGalleryIntroVideo(
        gallery,
        sourceImagePath,
        result.outputPath
      )
      const updated = await actions().update(row.id, {
        refGalleryJson: serializeActionGallery(nextGallery)
      })
      activity.append({
        kind: 'action',
        message: 'generateIntroVideo',
        meta: {
          actionId: row.id,
          sourceImagePath,
          path: result.outputPath
        }
      })
      return {
        action: updated,
        path: result.outputPath,
        sourceImagePath,
        gallery: nextGallery,
        polished: result.polished
      }
    }
  )
)

}
