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

export function registerStoriesHandlers(ctx: HandlerContext): void {
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

// ─── Stories ───────────────────────────────────────────────
reg(
  'stories:list',
  (async () => stories().list())
)
reg(
  'stories:get',
  (async ( id: string) => stories().get(id))
)
reg(
  'stories:create',
  (async ( input: CreateStoryInput) => stories().create(input))
)
reg(
  'stories:update',
  (
    async (
      id: string,
      data: {
        title?: string
        status?: string
        styleNote?: string | null
        hardRules?: string | null
        artStyle?: string | null
        coverPath?: string | null
        refGalleryJson?: string | null
      }
    ) => stories().update(id, data)
  )
)

/** Poster / list cover for a story (pure generate by default). */
reg(
  'stories:generateCover',
  (
    async (
      payload: {
        storyId: string
        referenceImagePath?: string | null
        referenceImagePaths?: string[] | null
        useIdentityEdit?: boolean
        idea?: string | null
        locale?: 'zh-HK' | 'en'
        promptOverride?: string | null
      }
    ) => {
      const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
      const row = await stories().get(payload.storyId)
      const title = String(
        (row as { title?: string }).title ??
          (locale === 'en' ? 'Story' : '故事')
      )
      const styleNote =
        typeof (row as { styleNote?: string | null }).styleNote === 'string'
          ? (row as { styleNote: string }).styleNote
          : ''
      const idea = (payload.idea ?? '').trim()
      const {
        aspectFromImageSize
      } = await import('../../types/settings')
      const { getArtStyle } = await import(
        '../../domain/characterArtStyles'
      )
      const { allRefPaths, appendMultiRefNote, pickPrimaryRefPath } =
        await import('../../domain/imageGenConfirm')
      const artStyle = getArtStyle(
        (row as { artStyle?: string | null }).artStyle ?? undefined
      )
      const size = ctx.settings.imageSizeWide || '1792x1024'
      const aspectRatio = aspectFromImageSize(size)
      // Image models follow English technical instructions best; story text
      // (title / style / idea) is kept in the user's UI language.
      const basePrompt =
        locale === 'en'
          ? [
              'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
              'Not a UI mockup. No text, no logo, no watermark, no title caption.',
              `Story title (mood only, do not letter it): ${title}.`,
              artStyle.promptBlock,
              styleNote ? `Style bible: ${styleNote}` : '',
              idea ? `Extra direction: ${idea}` : '',
              'Evocative establishing mood frame suitable as a library card cover.',
              'Match the art medium; strong silhouette and readable mood.'
            ]
              .filter(Boolean)
              .join(' ')
          : [
              'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
              'Not a UI mockup. No text, no logo, no watermark, no title caption.',
              `故事標題（只取氣氛，畫面勿寫出文字）：${title}。`,
              artStyle.promptBlock,
              styleNote ? `風格備註：${styleNote}` : '',
              idea ? `額外方向：${idea}` : '',
              '適合用作片庫封面的情緒建立鏡頭；強烈剪影、可讀氣氛。',
              '依藝術風格 medium 出圖；構圖清晰。'
            ]
              .filter(Boolean)
              .join(' ')
      const refList = allRefPaths(
        payload.referenceImagePath,
        payload.referenceImagePaths
      ).filter((p) => existsSync(p))
      const primary = pickPrimaryRefPath(
        payload.referenceImagePath,
        refList
      )
      const refPath =
        primary && existsSync(primary) ? primary : null
      const usedEdit = Boolean(
        payload.useIdentityEdit === true && refPath
      )
      const override =
        typeof payload.promptOverride === 'string' &&
        payload.promptOverride.trim()
          ? payload.promptOverride.trim()
          : null
      const editPrefix =
        locale === 'en'
          ? 'IMAGE EDIT: create a new short-drama poster composition. Keep identity/mood of subjects if present. '
          : 'IMAGE EDIT：以新構圖創作短劇海報。保留主體身份／氣氛（如有）。'
      let prompt = override ?? (usedEdit ? editPrefix + basePrompt : basePrompt)
      if (!override && refList.length > 1) {
        prompt = appendMultiRefNote(prompt, refList, locale)
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
      store.ensureTmpDir()
      const outPath = store.tmpImagePath('story_cover', '.png')
      writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
      return {
        path: outPath,
        draft: true,
        usedEdit,
        label: locale === 'en' ? 'Story cover' : '故事封面'
      }
    }
  )
)

reg(
  'stories:commitCover',
  (
    async (
      payload: { storyId: string; path: string; label?: string }
    ) => {
      const row = await stories().get(payload.storyId)
      if (!payload.path || !existsSync(payload.path)) {
        throw new AppError('NOT_FOUND', 'errors.draftNotFound')
      }
      const store = generation().getMediaStore()
      const finalPath = store.promoteTmpStoryImage(
        payload.storyId,
        payload.path,
        'cover'
      )
      const {
        appendGalleryItem,
        parseCharacterGallery,
        serializeCharacterGallery
      } = await import('../../domain/characterGallery')
      const gallery = parseCharacterGallery(
        (row as { refGalleryJson?: string | null }).refGalleryJson,
        {
          refImagePath: (row as { coverPath?: string | null }).coverPath
        }
      )
      const nextGallery = appendGalleryItem(gallery, {
        path: finalPath,
        kind: 'sheet',
        label: payload.label ?? 'Story cover'
      })
      const updated = await stories().update(payload.storyId, {
        coverPath: finalPath,
        refGalleryJson: serializeCharacterGallery(nextGallery)
      })
      return {
        story: updated,
        path: finalPath,
        gallery: nextGallery
      }
    }
  )
)
reg(
  'stories:delete',
  (async ( id: string) => stories().delete(id))
)
reg(
  'stories:seedDemo',
  (async ( locale?: 'zh-HK' | 'en') => {
    const result = await new DemoSeedService(host.getPrisma()).seed(locale ?? 'zh-HK')
    settingsStore.save({ firstRunSeen: true })
    return result
  })
)

/** AI style bible from title / idea. */
reg(
  'stories:aiFillMeta',
  (
    async (
      payload: {
        storyId?: string
        title?: string
        idea?: string
        existingStyleNote?: string | null
        existingHardRules?: string | null
        locale?: 'zh-HK' | 'en'
      }
    ) => {
      const locale = payload.locale ?? 'zh-HK'
      let title = payload.title?.trim() || ''
      let existingStyleNote = payload.existingStyleNote
      let existingHardRules = payload.existingHardRules
      if (payload.storyId) {
        const s = await stories().get(payload.storyId)
        title = title || s.title
        existingStyleNote =
          existingStyleNote ?? (s as { styleNote?: string | null }).styleNote
        existingHardRules =
          existingHardRules ??
          (s as { hardRules?: string | null }).hardRules
      }
      if (!title && !payload.idea?.trim()) {
        throw new AppError(
          'VALIDATION',
          'errors.ideaOrDraftRequired',
          'Enter a story title or idea first'
        )
      }
      const {
        buildStoryMetaSystemPrompt,
        buildStoryMetaUserPrompt,
        extractStoryMetaJson
      } = await import('../../domain/storyMasterPrompt')
      const contextSnippets: string[] = []
      if (payload.storyId) {
        const full = await host.getPrisma().story.findUnique({
          where: { id: payload.storyId },
          include: {
            storyCharacters: {
              take: 16,
              include: { character: true }
            },
            storyScenes: {
              take: 16,
              include: { scene: true },
              orderBy: { sceneNumber: 'asc' }
            },
            storyProps: { take: 12, include: { prop: true } }
          }
        })
        for (const link of full?.storyCharacters ?? []) {
          const c = link.character
          contextSnippets.push(
            `cast: ${c.name} — ${(c.description || c.appearance || '').slice(0, 120)}`
          )
        }
        for (const link of full?.storyScenes ?? []) {
          const s = link.scene
          contextSnippets.push(
            `scene #${link.sceneNumber}: ${(s.title || s.description || '').slice(0, 100)}`
          )
        }
        for (const link of full?.storyProps ?? []) {
          contextSnippets.push(`prop: ${link.prop.name}`)
        }
      }
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildStoryMetaSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildStoryMetaUserPrompt({
              title: title || (locale === 'en' ? 'Untitled short drama' : '未命名短劇'),
              idea: payload.idea,
              existingStyleNote,
              existingHardRules,
              contextSnippets,
              locale
            })
          }
        ],
        max_tokens: 1200
      })
      const raw = chatContentText(completion.choices[0]?.message.content)
      const meta = extractStoryMetaJson(raw, locale)
      activity.append({
        kind: 'story',
        message: 'aiFillMeta',
        storyId: payload.storyId,
        meta: {
          chars: meta.styleNote.length,
          hardRules: meta.hardRules.length
        }
      })
      return {
        styleNote: meta.styleNote,
        hardRules: meta.hardRules,
        raw
      }
    }
  )
)

/**
 * AI script beats → optional replace timeline entries.
 * Maps character/scene/prop names to cast ids when possible.
 */
reg(
  'stories:aiFillScript',
  (
    async (
      payload: {
        storyId: string
        idea?: string
        locale?: 'zh-HK' | 'en'
        /** When true, delete existing timeline then create new beats */
        replace?: boolean
      }
    ) => {
      const locale = payload.locale ?? 'zh-HK'
      if (!payload.storyId) {
        throw new AppError('VALIDATION', 'errors.storyIdRequired')
      }
      const story = await stories().get(payload.storyId)
      const {
        buildStoryBeatsSystemPrompt,
        buildStoryBeatsUserPrompt,
        extractStoryBeatsJson,
        resolveBeatIds
      } = await import('../../domain/storyMasterPrompt')
      const completion = await ctx.aiClient.chat({
        messages: [
          {
            role: 'system',
            content: buildStoryBeatsSystemPrompt(locale)
          },
          {
            role: 'user',
            content: buildStoryBeatsUserPrompt({
              title: story.title,
              styleNote: (story as { styleNote?: string | null }).styleNote,
              idea: payload.idea,
              characters: story.characters.map((c) => ({
                name: c.name,
                description: [
                  c.description,
                  c.appearance,
                  c.costume,
                  c.personality
                ]
                  .filter(Boolean)
                  .join(' · ')
                  .slice(0, 200)
              })),
              scenes: story.scenes.map((s) => ({
                sceneNumber: s.sceneNumber,
                title: s.title,
                description: [s.description, s.script]
                  .filter(Boolean)
                  .join(' | ')
                  .slice(0, 220)
              })),
              props: story.props.map((p) => ({
                name: p.name,
                description: p.description
              })),
              locale
            })
          }
        ],
        max_tokens: 3500
      })
      const raw = chatContentText(completion.choices[0]?.message.content)
      const drafts = extractStoryBeatsJson(raw, locale)
      const cast = {
        characters: story.characters.map((c) => ({
          id: c.id,
          name: c.name
        })),
        scenes: story.scenes.map((s) => ({
          id: s.id,
          sceneNumber: s.sceneNumber,
          title: s.title,
          description: s.description
        })),
        props: story.props.map((p) => ({ id: p.id, name: p.name }))
      }

      if (payload.replace !== false) {
        await host.getPrisma().timelineEntry.deleteMany({
          where: { storyId: payload.storyId }
        })
      }

      const created: Array<{
        id: string
        dialogue: string
        beatContentJson: string | null
        characterId: string | null
        sceneId: string | null
        propId: string | null
        order: number
      }> = []
      let orderBase = 0
      let timeCursor = 0
      if (payload.replace === false) {
        const max = await host.getPrisma().timelineEntry.aggregate({
          where: { storyId: payload.storyId },
          _max: { order: true, endTime: true }
        })
        orderBase = (max._max.order ?? -1) + 1
        timeCursor = max._max.endTime ?? 0
      }
      const { serializeIdList } = await import(
        '../../domain/timelineBindings'
      )
      const { snapVideoSeconds } = await import(
        '../../domain/videoDuration'
      )
      for (let i = 0; i < drafts.length; i++) {
        const ids = resolveBeatIds(drafts[i], cast)
        const order = orderBase + i
        // AI video hard limit is 6|10s — never create beats longer than that
        // or multi-select / dialogue save will fail validation on update.
        const dur = snapVideoSeconds(
          typeof ids.durationSeconds === 'number'
            ? ids.durationSeconds
            : 6
        )
        const start = timeCursor
        const end = start + dur
        timeCursor = end
        const row = await host.getPrisma().timelineEntry.create({
          data: {
            storyId: payload.storyId,
            startTime: start,
            endTime: end,
            order,
            dialogue: drafts[i].dialogue || drafts[i].scriptText,
            beatContentJson: drafts[i].beatContentJson,
            characterId: ids.characterId,
            sceneId: ids.sceneId,
            propId: ids.propId,
            characterIds: serializeIdList(ids.characterIds),
            sceneIds: serializeIdList(ids.sceneIds),
            propIds: serializeIdList(ids.propIds)
          }
        })
        created.push({
          id: row.id,
          dialogue: row.dialogue ?? '',
          beatContentJson:
            (row as { beatContentJson?: string | null }).beatContentJson ??
            null,
          characterId: row.characterId,
          sceneId: row.sceneId,
          propId: row.propId,
          order: row.order
        })
      }
      activity.append({
        kind: 'story',
        message: 'aiFillScript',
        storyId: payload.storyId,
        meta: { beats: created.length, replace: payload.replace !== false }
      })
      return { beats: created, drafts, raw }
    }
  )
)

}
