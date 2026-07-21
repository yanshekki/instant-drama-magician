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

export function registerScenesHandlers(ctx: HandlerContext): void {
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

// ─── Scenes ────────────────────────────────────────────────
reg(
  'scenes:list',
  (
    async (
      storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
    ) => {
      if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
        return scenes().listForStory(storyIdOrOpts)
      }
      if (
        storyIdOrOpts &&
        typeof storyIdOrOpts === 'object' &&
        storyIdOrOpts.forStory &&
        storyIdOrOpts.storyId
      ) {
        return scenes().listForStory(storyIdOrOpts.storyId)
      }
      const q =
        storyIdOrOpts && typeof storyIdOrOpts === 'object'
          ? storyIdOrOpts.q
          : undefined
      return scenes().list({ q })
    }
  )
)
reg(
  'scenes:create',
  (async ( input: CreateSceneInput) => scenes().create(input))
)
reg(
  'scenes:update',
  (async ( id: string, data: UpdateSceneInput) => scenes().update(id, data))
)
reg(
  'scenes:delete',
  (async ( id: string) => scenes().delete(id))
)

reg(
  'scenes:aiFill',
  (
    async (
      payload: {
        idea?: string
        storyId?: string
        /** all | scene:<id> | beat:<timelineEntryId> */
        segmentKey?: string | null
        locale?: 'zh-HK' | 'en'
        existingDraft?: Record<string, string | undefined | null>
        suggestFromStory?: boolean
        sceneNumber?: number
        /** Gallery / external still — vision fill from image alone is allowed */
        referenceImagePath?: string | null
      }
    ) => {
      const {
        buildSceneMasterSystemPrompt,
        buildSceneMasterUserPrompt,
        buildSceneSuggestFromStoryUserPrompt,
        extractSceneProfileJson
      } = await import('../domain/sceneMasterPrompt')
      const {
        buildVisionUserContent,
        resolveReadableImagePath,
        visionFillUserPreamble
      } = await import('../domain/chatVision')
      const locale = payload.locale ?? 'zh-HK'
      let storyTitle: string | undefined
      let styleNote: string | null | undefined
      const characterSnippets: string[] = []
      const propSnippets: string[] = []
      const priorSceneSnippets: string[] = []
      const existingTitles: string[] = []
      let segmentLabel: string | null = null
      let focusSnippets: string[] = []
      const draft = payload.existingDraft
      const hasDraft = Boolean(
        draft &&
          Object.values(draft).some((v) => typeof v === 'string' && v.trim())
      )
      const idea = payload.idea?.trim() ?? ''
      const refPath = resolveReadableImagePath(payload.referenceImagePath)
      const hasImage = Boolean(refPath)
      if (
        !idea &&
        !hasDraft &&
        !payload.suggestFromStory &&
        !hasImage
      ) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrImageRequired'
        )
      }
      if (payload.suggestFromStory && !payload.storyId?.trim()) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      // Pure invent-from-idea: only user idea (+ empty form). Inject story
      // cast/style only when refining a draft or explicitly suggesting from story.
      const { shouldInjectStoryContext } = await import(
        '../domain/storyContextPolicy'
      )
      const injectStoryContext = shouldInjectStoryContext({
        hasDraft,
        suggestFromStory: Boolean(payload.suggestFromStory)
      })
      if (payload.storyId && injectStoryContext) {
        const story = await host.getPrisma().story.findUnique({
          where: { id: payload.storyId },
          include: {
            storyCharacters: {
              take: 12,
              include: { character: true }
            },
            storyProps: { take: 12, include: { prop: true } },
            storyScenes: {
              orderBy: { sceneNumber: 'asc' },
              take: 40,
              include: { scene: true }
            },
            timeline: {
              orderBy: { order: 'asc' },
              take: 80,
              include: {
                character: true,
                scene: true,
                prop: true
              }
            }
          }
        })
        if (!story) {
          throw new AppError('NOT_FOUND', 'errors.storyNotFound', String(payload.storyId))
        }
        storyTitle = story.title
        styleNote = story.styleNote
        for (const link of story.storyCharacters ?? []) {
          const c = link.character
          characterSnippets.push(
            `${c.name}: ${(c.description || '').slice(0, 120)} | costume: ${(c.costume || '').slice(0, 80)}`
          )
        }
        for (const link of story.storyProps ?? []) {
          const p = link.prop
          propSnippets.push(`${p.name}: ${(p.description || '').slice(0, 100)}`)
        }
        for (const link of story.storyScenes ?? []) {
          const s = link.scene
          existingTitles.push(s.title || s.description.slice(0, 40))
          priorSceneSnippets.push(
            `#${link.sceneNumber} ${s.title || ''}: ${s.description.slice(0, 200)}`
          )
        }

        // Resolve plot focus for suggest-from-story
        if (payload.suggestFromStory) {
          const seg = (payload.segmentKey ?? 'all').trim() || 'all'
          if (seg === 'all') {
            segmentLabel =
              locale === 'en' ? 'Entire story (all scenes)' : '全劇（所有場次）'
            focusSnippets = story.storyScenes.map((link) => {
              const s = link.scene
              const script = link.scriptOverride ?? s.script
              return [
                `Scene ${link.sceneNumber}: ${s.title || s.description}`,
                s.description,
                script ? String(script).slice(0, 500) : ''
              ]
                .filter(Boolean)
                .join('\n')
            })
            for (const beat of story.timeline.slice(0, 12)) {
              if (!beat.dialogue?.trim()) continue
              const who = beat.character?.name ?? '?'
              focusSnippets.push(
                `Beat ${beat.order + 1} [${who}]: ${beat.dialogue.slice(0, 300)}`
              )
            }
          } else if (seg.startsWith('scene:')) {
            const sceneId = seg.slice('scene:'.length)
            const link = story.storyScenes.find((l) => l.sceneId === sceneId)
            if (!link) {
              throw new AppError(
                'VALIDATION',
                'errors.sceneNotLinked'
              )
            }
            const s = link.scene
            const script = link.scriptOverride ?? s.script
            segmentLabel =
              locale === 'en'
                ? `Scene ${link.sceneNumber}: ${s.title || s.description.slice(0, 40)}`
                : `第 ${link.sceneNumber} 場：${s.title || s.description.slice(0, 40)}`
            focusSnippets = [
              [
                segmentLabel,
                s.description,
                script ? String(script).slice(0, 800) : '',
                s.mood ? `mood: ${s.mood}` : '',
                s.timeOfDay ? `time: ${s.timeOfDay}` : '',
                s.weather ? `weather: ${s.weather}` : ''
              ]
                .filter(Boolean)
                .join('\n')
            ]
            for (const beat of story.timeline) {
              if (beat.sceneId !== sceneId || !beat.dialogue?.trim()) continue
              const who = beat.character?.name ?? '?'
              focusSnippets.push(
                `Dialogue [${who}]: ${beat.dialogue.slice(0, 400)}`
              )
            }
          } else if (seg.startsWith('beat:')) {
            const entryId = seg.slice('beat:'.length)
            const beat = story.timeline.find((e) => e.id === entryId)
            if (!beat) {
              throw new AppError('VALIDATION', 'errors.timelineBeatNotFound')
            }
            const who =
              beat.character?.name ??
              (locale === 'en' ? 'Unknown' : '未指定')
            const where =
              beat.scene?.title ||
              beat.scene?.description?.slice(0, 40) ||
              ''
            segmentLabel =
              locale === 'en'
                ? `Beat ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
                : `段落 ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
            focusSnippets = [
              [
                segmentLabel,
                beat.dialogue ? `Dialogue: ${beat.dialogue}` : '',
                beat.scene
                  ? `Location: ${beat.scene.description}`
                  : '',
                beat.prop ? `Prop: ${beat.prop.name}` : ''
              ]
                .filter(Boolean)
                .join('\n')
            ]
          } else {
            throw new AppError('VALIDATION', 'errors.unknownSegmentKey', String(seg))
          }
        }
      }
      const ideaForPrompt =
        idea ||
        (hasImage
          ? locale === 'en'
            ? 'Describe and invent a full location profile from the attached reference photo.'
            : '請根據附上的參考圖，完整填寫場景資料。'
          : locale === 'en'
            ? 'Polish'
            : '全面潤飾')
      const textPrompt = payload.suggestFromStory
        ? buildSceneSuggestFromStoryUserPrompt({
            storyTitle: storyTitle || 'Untitled',
            styleNote,
            locale,
            sceneNumber: payload.sceneNumber ?? existingTitles.length + 1,
            existingSceneTitles: existingTitles,
            characterSnippets,
            propSnippets,
            priorSceneSnippets,
            segmentLabel,
            focusSnippets
          })
        : [
            hasImage ? visionFillUserPreamble(locale, 'scene') : null,
            buildSceneMasterUserPrompt({
              idea: ideaForPrompt,
              storyTitle,
              styleNote,
              locale,
              characterSnippets,
              propSnippets,
              priorSceneSnippets,
              existingDraft: (hasDraft
                ? {
                    title: draft?.title ?? undefined,
                    description: draft?.description ?? undefined,
                    script: draft?.script ?? undefined,
                    locationType: draft?.locationType ?? undefined,
                    timeOfDay: draft?.timeOfDay ?? undefined,
                    weather: draft?.weather ?? undefined,
                    mood: draft?.mood ?? undefined,
                    lighting: draft?.lighting ?? undefined,
                    colorPalette: draft?.colorPalette ?? undefined,
                    setDressing: draft?.setDressing ?? undefined,
                    soundscape: draft?.soundscape ?? undefined,
                    cameraNotes: draft?.cameraNotes ?? undefined,
                    visualTags: draft?.visualTags ?? undefined,
                    artStyle: draft?.artStyle ?? undefined
                  }
                : null) as Partial<SceneProfileFields> | null
            })
          ]
            .filter(Boolean)
            .join('\n\n')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildSceneMasterSystemPrompt(locale)
          },
          {
            role: 'user',
            content: payload.suggestFromStory
              ? textPrompt
              : buildVisionUserContent(textPrompt, refPath)
          }
        ],
        max_tokens: 2500
      })
      const text = chatContentText(completion.choices[0]?.message.content)
      let profile = extractSceneProfileJson(text)
      const { fillMissingProfileFields } = await import(
        '../domain/profileFillMissing'
      )
      const { SCENE_PROFILE_JSON_KEYS } = await import(
        '../domain/sceneMasterPrompt'
      )
      const sceneRequired = SCENE_PROFILE_JSON_KEYS.filter(
        (k) => k !== 'artStyle' && k !== 'hardRules'
      )
      const scenePatch = await fillMissingProfileFields({
        profile: profile as unknown as Record<string, unknown>,
        requiredKeys: sceneRequired,
        locale,
        chat: (req) => ctx.aiClient.chat(req),
        referenceImagePath: refPath,
        maxTokens: 1200
      })
      profile = scenePatch.profile as unknown as typeof profile
      const sceneRaw = scenePatch.raw
        ? `${text}\n---missing-fill---\n${scenePatch.raw}`
        : text
      activity.append({
        kind: 'scene',
        message: payload.suggestFromStory
          ? 'suggestScene'
          : hasImage
            ? 'aiFillSceneFromImage'
            : hasDraft
              ? 'aiRefineScene'
              : 'aiFillScene',
        storyId: payload.storyId,
        meta: {
          title: profile.title,
          segmentKey: payload.segmentKey ?? null,
          usedImage: hasImage,
          patchedKeys: scenePatch.patchedKeys
        }
      })
      return {
        profile,
        profileJson: JSON.stringify(profile, null, 2),
        raw: sceneRaw
      }
    }
  )
)

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
      } = await import('../domain/scenePlateVariants')
      const { getArtStyle } = await import(
        '../domain/characterArtStyles'
      )
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../domain/sceneGallery')
      const {
        aspectFromImageSize,
        imageSizeForScenePlate
      } = await import('../types/settings')

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
        await import('../domain/imageGenConfirm')
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
      const { resolveSheetGenMode } = await import(
        '../domain/characterMasterPrompt'
      )
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
  'scenes:generateIntroVideo',
  (
    async (
      payload: {
        sceneId: string
        sourceImagePath: string
        durationSeconds?: number
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const row = await scenes().get(payload.sceneId)
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
        title: row.title ?? undefined,
        description: row.description || row.title || 'Scene',
        script: row.script ?? undefined,
        locationType: row.locationType ?? undefined,
        timeOfDay: row.timeOfDay ?? undefined,
        weather: row.weather ?? undefined,
        mood: row.mood ?? undefined,
        lighting: row.lighting ?? undefined,
        colorPalette: row.colorPalette ?? undefined,
        setDressing: row.setDressing ?? undefined,
        soundscape: row.soundscape ?? undefined,
        cameraNotes: row.cameraNotes ?? undefined,
        visualTags: row.visualTags ?? undefined,
        artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined
      }
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const fallbackPrompt = buildSceneIntroVideoPrompt(profile, locale)
      const store = generation().getMediaStore()
      store.ensureLibraryDirs()
      const outPath = store.sceneVideoPath(row.id, 'intro', '.mp4')
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
        buildSceneIntroVideoPolishUserPrompt
      } = await import('../domain/videoPromptPolish')

      const sceneHardRules = row.hardRules ?? null
      const result = await polishThenGenerateVideo({
        ai: ctx.aiClient,
        locale,
        fallbackPrompt,
        hardRules: sceneHardRules,
        polishUserContent: buildSceneIntroVideoPolishUserPrompt({
          locale,
          seconds,
          aspectRatio,
          hasRefImage: true,
          fallbackPrompt,
          title: profile.title,
          description: profile.description,
          script: profile.script,
          locationType: profile.locationType,
          timeOfDay: profile.timeOfDay,
          weather: profile.weather,
          mood: profile.mood,
          lighting: profile.lighting,
          colorPalette: profile.colorPalette,
          setDressing: profile.setDressing,
          soundscape: profile.soundscape,
          cameraNotes: profile.cameraNotes,
          visualTags: profile.visualTags,
          artStyle: profile.artStyle,
          seedPrompt:
            (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          hardRules: sceneHardRules
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
      const updated = await scenes().update(row.id, {
        refGalleryJson: serializeSceneGallery(nextGallery)
      })
      activity.append({
        kind: 'scene',
        message: 'generateIntroVideo',
        meta: {
          sceneId: row.id,
          sourceImagePath,
          path: result.outputPath,
          seconds,
          degraded: result.degraded ?? false,
          polished: result.polished,
          promptPreview: result.promptUsed.slice(0, 200)
        }
      })
      return {
        scene: updated,
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
      } = await import('../domain/sceneGallery')
      const { getScenePlateVariant, isScenePlateVariantId } = await import(
        '../domain/scenePlateVariants'
      )
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
        } = await import('../domain/sceneLooks')
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
      } = await import('../domain/sceneAtmosphere')
      const { getArtStyle } = await import(
        '../domain/characterArtStyles'
      )
      const {
        appendSceneGalleryItem,
        parseSceneGallery,
        primarySceneGalleryPath,
        serializeSceneGallery
      } = await import('../domain/sceneGallery')
      const { aspectFromImageSize } = await import('../types/settings')

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
      const { enhanceCharacterImage } = await import(
        '../infrastructure/media/imageEnhance'
      )
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
reg(
  'scenes:copyGalleryFrom',
  (
    async (
      payload: { targetSceneId: string; sourceSceneId: string }
    ) => {
      const target = await scenes().get(payload.targetSceneId)
      const source = await scenes().get(payload.sourceSceneId)
      const {
        parseSceneGallery,
        serializeSceneGallery,
        primarySceneGalleryPath
      } = await import('../domain/sceneGallery')
      const srcGallery = parseSceneGallery(source.refGalleryJson, {
        refImagePath: source.refImagePath
      })
      if (srcGallery.length === 0) {
        throw new AppError('VALIDATION', 'errors.sourceSceneNoGallery')
      }
      const updated = await scenes().update(target.id, {
        refGalleryJson: serializeSceneGallery(srcGallery),
        refImagePath:
          primarySceneGalleryPath(srcGallery) ?? source.refImagePath,
        locationKey:
          target.locationKey ||
          source.locationKey ||
          source.title ||
          target.title
      })
      activity.append({
        kind: 'scene',
        message: 'copyGalleryFrom',
        meta: {
          targetSceneId: target.id,
          sourceSceneId: source.id,
          count: srcGallery.length
        }
      })
      return { scene: updated, gallery: srcGallery }
    }
  )
)

}
