import type {
  BrowserWindow,
  Dialog,
  IpcMain,
  IpcMainInvokeEvent,
  OpenDialogOptions,
  Shell
} from 'electron'
import { app } from 'electron'
import type { PrismaClient } from '../../src/types/prisma'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, extname, join } from 'path'
import { GrokCliClient } from '../../src/infrastructure/ai/GrokCliClient'
import { SettingsStore } from '../../src/infrastructure/settings/SettingsStore'
import {
  CharacterService,
  CostumeService,
  DemoSeedService,
  GenerationService,
  ProjectBackupService,
  PropService,
  SceneService,
  StoryCastService,
  StoryService,
  TimelinePersistenceService
} from '../../src/application/services'
import { MediaStore } from '../../src/infrastructure/media/MediaStore'
import { ActivityLog } from '../../src/infrastructure/activity/ActivityLog'
import {
  redactSettings,
  supportReportPath,
  writeSupportReportJson
} from '../../src/infrastructure/support/SupportReport'
import { appUpdateService } from '../../src/infrastructure/update/AppUpdateService'
import type {
  CreateCharacterInput,
  CreatePropInput,
  CreateSceneInput,
  CreateStoryInput,
  CreateTimelineEntryInput,
  UpdateCharacterInput,
  UpdatePropInput,
  UpdateSceneInput,
  UpdateTimelineEntryInput
} from '../../src/types/domain'
import { SoulMdHubClient } from '../../src/infrastructure/soulmd/SoulMdHubClient'
import {
  buildCharacterIntroVideoPrompt,
  buildCharacterMasterSystemPrompt,
  buildCharacterMasterUserPrompt,
  buildCharacterSheetEditPrompt,
  buildCharacterSheetImagePrompt,
  extractCharacterProfileJson
} from '../../src/domain/characterMasterPrompt'
import { buildSceneIntroVideoPrompt } from '../../src/domain/sceneMasterPrompt'
import { buildPropIntroVideoPrompt } from '../../src/domain/propMasterPrompt'
import { buildCostumeIntroVideoPrompt } from '../../src/domain/costumeSwap'
import {
  buildSoulGenerateSystemPrompt,
  buildSoulGenerateUserPrompt,
  normalizeSoulMarkdown,
  profileHasSoulSource
} from '../../src/domain/soulGenerate'
// resolveSheetGenMode imported dynamically where needed to avoid circular weight
import {
  appendGalleryItem,
  MAX_IMAGE_EDIT_REFERENCES,
  parseCharacterGallery,
  pickGalleryReferencePaths,
  primaryGalleryPath,
  serializeCharacterGallery,
  setGalleryIntroVideo
} from '../../src/domain/characterGallery'
import type { AppSettings } from '../../src/types/settings'
import { AppError, toAppError } from '../../src/types/errors'
import {
  extractDescriptionFromSoulMd,
  extractNameFromSoulMd,
  isSoulMdPath,
  parseSoulMd
} from '../../src/domain/character'

export interface IpcContext {
  ipcMain: IpcMain
  dialog: Dialog
  shell: Shell
  getPrisma: () => PrismaClient
  getMainWindow: () => BrowserWindow | null
}

/** Redact secrets from IPC args for audit log. */
function summarizeArgs(channel: string, args: unknown[]): unknown {
  try {
    const raw = JSON.parse(JSON.stringify(args)) as unknown[]
    if (channel === 'settings:set' && raw[0] && typeof raw[0] === 'object') {
      const o = raw[0] as Record<string, unknown>
      if (typeof o.apiKey === 'string' && o.apiKey) o.apiKey = '[redacted]'
      if (typeof o.ttsHttpUrl === 'string' && o.ttsHttpUrl) o.ttsHttpUrl = '[set]'
    }
    // Cap huge payloads
    const s = JSON.stringify(raw)
    if (s.length > 2000) return { truncated: true, preview: s.slice(0, 2000) }
    return raw
  } catch {
    return { note: 'unserializable_args' }
  }
}

/** Late-bound: set inside registerIpcHandlers before any handle() calls. */
let _activity: ActivityLog | null = null
let _ipcMain: IpcMain | null = null
function activityRef(): ActivityLog | null {
  return _activity
}

/**
 * Register IPC handler with automatic audit log (success + error).
 * Skips recursive logging for activity:* channels.
 */
function handle(
  channel: string,
  fn: (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<unknown>
): void {
  if (!_ipcMain) {
    throw new Error('handle() called before registerIpcHandlers')
  }
  _ipcMain.handle(channel, async (event, ...args) => {
    const t0 = Date.now()
    try {
      const result = await fn(event, ...args)
      if (!channel.startsWith('activity:')) {
        activityRef()?.append({
          kind: 'ipc',
          level: 'info',
          message: channel,
          meta: {
            ok: true,
            ms: Date.now() - t0,
            args: summarizeArgs(channel, args)
          }
        })
      }
      return result
    } catch (error) {
      const body = toAppError(error)
      if (!channel.startsWith('activity:')) {
        activityRef()?.append({
          kind: 'ipc',
          level: 'error',
          message: channel,
          meta: {
            ok: false,
            ms: Date.now() - t0,
            code: body.code,
            error: body.message,
            details: body.details ?? null,
            args: summarizeArgs(channel, args)
          }
        })
      }
      throw new Error(JSON.stringify(body))
    }
  })
}

export function registerIpcHandlers(ctx: IpcContext): void {
  const { ipcMain, dialog, shell, getPrisma, getMainWindow } = ctx
  _ipcMain = ipcMain
  const settingsStore = new SettingsStore(
    SettingsStore.defaultPath(app.getPath('userData'))
  )
  let settings = settingsStore.load()
  let aiClient = new GrokCliClient(settings)
  const mediaRoot = (): string => join(app.getPath('userData'), 'media')
  const activity = new ActivityLog(ActivityLog.defaultPath(app.getPath('userData')))
  _activity = activity
  activity.append({
    kind: 'app',
    level: 'info',
    message: 'ipc_handlers_registered',
    meta: { userData: app.getPath('userData') }
  })

  const stories = (): StoryService => new StoryService(getPrisma())
  const characters = (): CharacterService => new CharacterService(getPrisma())
  const scenes = (): SceneService => new SceneService(getPrisma())
  const props = (): PropService => new PropService(getPrisma())
  const costumes = (): CostumeService => new CostumeService(getPrisma())
  const timeline = (): TimelinePersistenceService =>
    new TimelinePersistenceService(getPrisma())

  // Singleton so cancel() can abort the in-flight run
  let generationService: GenerationService | null = null
  const generation = (): GenerationService => {
    if (!generationService) {
      generationService = new GenerationService(getPrisma(), aiClient, {
        mediaRoot: mediaRoot(),
        settings
      })
    }
    return generationService
  }

  const rebindAi = (next: AppSettings): void => {
    settings = next
    aiClient = new GrokCliClient(settings)
    generation().rebindAi(aiClient, settings)
  }

  // ─── Stories ───────────────────────────────────────────────
  handle(
    'stories:list',
    (async () => stories().list())
  )
  handle(
    'stories:get',
    (async (_e, id: string) => stories().get(id))
  )
  handle(
    'stories:create',
    (async (_e, input: CreateStoryInput) => stories().create(input))
  )
  handle(
    'stories:update',
    (
      async (
        _e,
        id: string,
        data: {
          title?: string
          status?: string
          styleNote?: string | null
          coverPath?: string | null
          refGalleryJson?: string | null
        }
      ) => stories().update(id, data)
    )
  )

  /** Poster / list cover for a story (pure generate by default). */
  handle(
    'stories:generateCover',
    (
      async (
        _e,
        payload: {
          storyId: string
          referenceImagePath?: string | null
          useIdentityEdit?: boolean
          idea?: string | null
          locale?: 'zh-HK' | 'en'
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
        } = await import('../../src/types/settings')
        const size = settings.imageSizeWide || '1792x1024'
        const aspectRatio = aspectFromImageSize(size)
        // Image models follow English technical instructions best; story text
        // (title / style / idea) is kept in the user's UI language.
        const prompt =
          locale === 'en'
            ? [
                'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
                'Not a UI mockup. No text, no logo, no watermark, no title caption.',
                `Story title (mood only, do not letter it): ${title}.`,
                styleNote ? `Style bible: ${styleNote}` : '',
                idea ? `Extra direction: ${idea}` : '',
                'Evocative establishing mood frame suitable as a library card cover.',
                'Photoreal cinematic or match the style bible; strong silhouette and readable mood.'
              ]
                .filter(Boolean)
                .join(' ')
            : [
                'PROFESSIONAL SHORT-DRAMA POSTER / KEY ART (16:9 cinematic still).',
                'Not a UI mockup. No text, no logo, no watermark, no title caption.',
                `故事標題（只取氣氛，畫面勿寫出文字）：${title}。`,
                styleNote ? `風格備註：${styleNote}` : '',
                idea ? `額外方向：${idea}` : '',
                '適合用作片庫封面的情緒建立鏡頭；強烈剪影、可讀氣氛。',
                '寫實電影感或依風格備註；構圖清晰。'
              ]
                .filter(Boolean)
                .join(' ')
        const explicitRef =
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const usedEdit = Boolean(
          payload.useIdentityEdit === true && refPath
        )
        const editPrefix =
          locale === 'en'
            ? 'IMAGE EDIT: create a new short-drama poster composition. Keep identity/mood of subjects if present. '
            : 'IMAGE EDIT：以新構圖創作短劇海報。保留主體身份／氣氛（如有）。'
        const img = usedEdit
          ? await aiClient.editImage({
              prompt: editPrefix + prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({ prompt, size, aspectRatio })
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

  handle(
    'stories:commitCover',
    (
      async (
        _e,
        payload: { storyId: string; path: string; label?: string }
      ) => {
        const row = await stories().get(payload.storyId)
        if (!payload.path || !existsSync(payload.path)) {
          throw new AppError('NOT_FOUND', 'Draft cover file not found')
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
        } = await import('../../src/domain/characterGallery')
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
  handle(
    'stories:delete',
    (async (_e, id: string) => stories().delete(id))
  )
  handle(
    'stories:seedDemo',
    (async (_e, locale?: 'zh-HK' | 'en') => {
      const result = await new DemoSeedService(getPrisma()).seed(locale ?? 'zh-HK')
      settingsStore.save({ firstRunSeen: true })
      return result
    })
  )

  /** AI style bible from title / idea. */
  handle(
    'stories:aiFillMeta',
    (
      async (
        _e,
        payload: {
          storyId?: string
          title?: string
          idea?: string
          existingStyleNote?: string | null
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const locale = payload.locale ?? 'zh-HK'
        let title = payload.title?.trim() || ''
        let existingStyleNote = payload.existingStyleNote
        if (payload.storyId) {
          const s = await stories().get(payload.storyId)
          title = title || s.title
          existingStyleNote =
            existingStyleNote ?? (s as { styleNote?: string | null }).styleNote
        }
        if (!title && !payload.idea?.trim()) {
          throw new AppError(
            'VALIDATION',
            'Title or idea is required',
            'Enter a story title or idea first'
          )
        }
        const {
          buildStoryMetaSystemPrompt,
          buildStoryMetaUserPrompt,
          extractStyleNoteJson
        } = await import('../../src/domain/storyMasterPrompt')
        const contextSnippets: string[] = []
        if (payload.storyId) {
          const full = await getPrisma().story.findUnique({
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
        const completion = await aiClient.chat({
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
                contextSnippets,
                locale
              })
            }
          ],
          max_tokens: 800
        })
        const raw = completion.choices[0]?.message.content ?? ''
        const styleNote = extractStyleNoteJson(raw)
        activity.append({
          kind: 'story',
          message: 'aiFillMeta',
          storyId: payload.storyId,
          meta: { chars: styleNote.length }
        })
        return { styleNote, raw }
      }
    )
  )

  /**
   * AI script beats → optional replace timeline entries.
   * Maps character/scene/prop names to cast ids when possible.
   */
  handle(
    'stories:aiFillScript',
    (
      async (
        _e,
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
          throw new AppError('VALIDATION', 'storyId is required')
        }
        const story = await stories().get(payload.storyId)
        const {
          buildStoryBeatsSystemPrompt,
          buildStoryBeatsUserPrompt,
          extractStoryBeatsJson,
          resolveBeatIds
        } = await import('../../src/domain/storyMasterPrompt')
        const completion = await aiClient.chat({
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
        const raw = completion.choices[0]?.message.content ?? ''
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
          await getPrisma().timelineEntry.deleteMany({
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
          const max = await getPrisma().timelineEntry.aggregate({
            where: { storyId: payload.storyId },
            _max: { order: true, endTime: true }
          })
          orderBase = (max._max.order ?? -1) + 1
          timeCursor = max._max.endTime ?? 0
        }
        const { serializeIdList } = await import(
          '../../src/domain/timelineBindings'
        )
        for (let i = 0; i < drafts.length; i++) {
          const ids = resolveBeatIds(drafts[i], cast)
          const order = orderBase + i
          const dur = Math.max(4, Math.min(15, ids.durationSeconds || 6))
          const start = timeCursor
          const end = start + dur
          timeCursor = end
          const row = await getPrisma().timelineEntry.create({
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

  // ─── Characters ────────────────────────────────────────────
  handle(
    'characters:list',
    (
      async (
        _e,
        storyIdOrOpts?: string | { storyId?: string; q?: string; forStory?: boolean }
      ) => {
        // Back-compat: list(storyId) → listForStory; list() / list({q}) → global
        if (typeof storyIdOrOpts === 'string' && storyIdOrOpts) {
          return characters().listForStory(storyIdOrOpts)
        }
        if (
          storyIdOrOpts &&
          typeof storyIdOrOpts === 'object' &&
          storyIdOrOpts.forStory &&
          storyIdOrOpts.storyId
        ) {
          return characters().listForStory(storyIdOrOpts.storyId)
        }
        const q =
          storyIdOrOpts && typeof storyIdOrOpts === 'object'
            ? storyIdOrOpts.q
            : undefined
        return characters().list({ q })
      }
    )
  )
  handle(
    'characters:create',
    (async (_e, input: CreateCharacterInput) => characters().create(input))
  )
  handle(
    'characters:update',
    (async (_e, id: string, data: UpdateCharacterInput) =>
      characters().update(id, data)
    )
  )
  handle(
    'characters:delete',
    (async (_e, id: string) => characters().delete(id))
  )
  /** Suggest wardrobe + art style from story plot (chosen story + segment). */
  handle(
    'characters:suggestWardrobe',
    (
      async (
        _e,
        payload: {
          characterId?: string
          storyId?: string
          /** all | scene:<id> | beat:<timelineEntryId> */
          segmentKey?: string | null
          locale?: 'zh-HK' | 'en'
          name?: string
          appearance?: string | null
          costume?: string | null
          ageRange?: string | null
          gender?: string | null
          description?: string | null
          personality?: string | null
          visualTags?: string | null
          mannerisms?: string | null
          soulExcerpt?: string | null
          userRequest?: string | null
          existingCostumeNames?: string[]
        }
      ) => {
        const locale = payload.locale ?? 'zh-HK'
        let storyTitle: string | undefined
        let styleNote: string | null | undefined
        let storyId = payload.storyId
        let characterName = payload.name?.trim() || ''
        let appearance = payload.appearance
        let costume = payload.costume
        let ageRange = payload.ageRange
        let gender = payload.gender
        let description = payload.description
        let personality = payload.personality
        let visualTags = payload.visualTags
        let mannerisms = payload.mannerisms
        let soulExcerpt = payload.soulExcerpt
        const userRequest = payload.userRequest
        let existingNames = payload.existingCostumeNames ?? []
        let sceneSnippets: string[] = []
        let segmentLabel: string | null = null

        if (payload.characterId) {
          const row = await characters().get(payload.characterId)
          characterName = characterName || row.name
          appearance = appearance ?? row.appearance
          costume = costume ?? row.costume
          ageRange = ageRange ?? row.ageRange
          gender = gender ?? row.gender
          description = description ?? row.description
          personality = personality ?? row.personality
          visualTags = visualTags ?? row.visualTags
          mannerisms = mannerisms ?? row.mannerisms
          if (!existingNames.length) {
            const { parseCharacterCostumes } = await import(
              '../../src/domain/characterCostumes'
            )
            existingNames = parseCharacterCostumes(
              (row as { costumesJson?: string | null }).costumesJson
            ).map((c) => c.name)
          }
        }
        if (!characterName) {
          throw new AppError('VALIDATION', 'Character name is required')
        }
        if (storyId) {
          const story = await getPrisma().story.findUnique({
            where: { id: storyId },
            include: {
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
          if (!story) throw new AppError('NOT_FOUND', `Story not found: ${storyId}`)
          storyTitle = story.title
          styleNote = story.styleNote
          const seg = (payload.segmentKey ?? 'all').trim() || 'all'

          if (seg === 'all') {
            segmentLabel =
              locale === 'en' ? 'Entire story (all scenes)' : '全劇（所有場次）'
            sceneSnippets = story.storyScenes.map((link) => {
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
            // Also fold short dialogue beats when available
            for (const beat of story.timeline.slice(0, 12)) {
              if (!beat.dialogue?.trim()) continue
              const who = beat.character?.name ?? '?'
              sceneSnippets.push(
                `Beat ${beat.order + 1} [${who}]: ${beat.dialogue.slice(0, 300)}`
              )
            }
          } else if (seg.startsWith('scene:')) {
            const sceneId = seg.slice('scene:'.length)
            const link = story.storyScenes.find((l) => l.sceneId === sceneId)
            if (!link) {
              throw new AppError('VALIDATION', 'Scene not linked to this story')
            }
            const s = link.scene
            const script = link.scriptOverride ?? s.script
            segmentLabel =
              locale === 'en'
                ? `Scene ${link.sceneNumber}: ${s.title || s.description.slice(0, 40)}`
                : `第 ${link.sceneNumber} 場：${s.title || s.description.slice(0, 40)}`
            sceneSnippets = [
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
              sceneSnippets.push(
                `Dialogue [${who}]: ${beat.dialogue.slice(0, 400)}`
              )
            }
          } else if (seg.startsWith('beat:')) {
            const entryId = seg.slice('beat:'.length)
            const beat = story.timeline.find((e) => e.id === entryId)
            if (!beat) {
              throw new AppError('VALIDATION', 'Timeline beat not found')
            }
            const who = beat.character?.name ?? (locale === 'en' ? 'Unknown' : '未指定')
            const where =
              beat.scene?.title || beat.scene?.description?.slice(0, 40) || ''
            segmentLabel =
              locale === 'en'
                ? `Beat ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
                : `段落 ${beat.order + 1} · ${who}${where ? ` @ ${where}` : ''}`
            sceneSnippets = [
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
            throw new AppError('VALIDATION', `Unknown segmentKey: ${seg}`)
          }
        } else {
          segmentLabel =
            locale === 'en' ? 'No story selected' : '未選故事（僅角色資料）'
        }

        const {
          buildWardrobeSuggestSystemPrompt,
          buildWardrobeSuggestUserPrompt,
          extractWardrobeSuggestionJson
        } = await import('../../src/domain/wardrobeSuggest')
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildWardrobeSuggestSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildWardrobeSuggestUserPrompt({
                characterName,
                appearance,
                currentCostume: costume,
                ageRange,
                gender,
                description,
                personality,
                visualTags,
                mannerisms,
                soulExcerpt: soulExcerpt ?? null,
                userRequest: userRequest ?? null,
                storyTitle: storyTitle ?? null,
                styleNote: styleNote ?? null,
                sceneSnippets,
                segmentLabel,
                locale,
                existingCostumeNames: existingNames
              })
            }
          ],
          max_tokens: 1200
        })
        const text = completion.choices[0]?.message.content ?? ''
        const suggestion = extractWardrobeSuggestionJson(text)
        activity.append({
          kind: 'character',
          message: 'suggestWardrobe',
          storyId: storyId ?? undefined,
          meta: {
            characterId: payload.characterId ?? null,
            name: suggestion.name,
            artStyle: suggestion.artStyle,
            segmentKey: payload.segmentKey ?? 'all'
          }
        })
        return { suggestion, raw: text, segmentLabel, storyTitle }
      }
    )
  )

  handle(
    'characters:aiFill',
    (
      async (
        _e,
        payload: {
          idea?: string
          storyId?: string
          locale?: 'zh-HK' | 'en'
          /** Current form fields — enables create + edit refine */
          existingDraft?: Record<string, unknown>
          /** Full soul.md / hub markdown for identity merge */
          soulContent?: string | null
        }
      ) => {
        const idea = payload.idea?.trim() ?? ''
        const draft = payload.existingDraft
        const soulContent = payload.soulContent?.trim() ?? ''
        const hasDraft = Boolean(
          draft &&
            Object.values(draft).some((v) => {
              if (typeof v === 'string') return v.trim().length > 0
              if (Array.isArray(v)) return v.length > 0
              return v != null && String(v).trim().length > 0
            })
        )
        const hasSoul = soulContent.length > 0
        if (!idea && !hasDraft && !hasSoul) {
          throw new AppError(
            'VALIDATION',
            'Idea, profile draft, or soul content is required'
          )
        }
        // Character invent uses only idea + form + soul (not the open story’s style).
        // Scene / clip / wardrobe flows own story continuity.
        const { shouldInjectStoryContextForCharacter } = await import(
          '../../src/domain/storyContextPolicy'
        )
        let storyTitle: string | undefined
        let styleNote: string | null | undefined
        if (payload.storyId && shouldInjectStoryContextForCharacter()) {
          const story = await getPrisma().story.findUnique({
            where: { id: payload.storyId }
          })
          storyTitle = story?.title
          styleNote = story?.styleNote
        }
        const locale = payload.locale ?? 'zh-HK'
        const str = (k: string): string | undefined => {
          const v = draft?.[k]
          if (typeof v === 'string' && v.trim()) return v.trim()
          return undefined
        }
        const spokenRaw = draft?.spokenLanguages
        const spokenLanguages = Array.isArray(spokenRaw)
          ? spokenRaw.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          : typeof spokenRaw === 'string' && spokenRaw.trim()
            ? spokenRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
            : undefined
        const existingDraft = hasDraft
          ? {
              name: str('name'),
              description: str('description'),
              appearance: str('appearance'),
              personality: str('personality'),
              backstory: str('backstory'),
              costume: str('costume'),
              ageRange: str('ageRange'),
              gender: str('gender'),
              voiceDesc: str('voiceDesc'),
              spokenLanguages:
                spokenLanguages && spokenLanguages.length > 0
                  ? spokenLanguages
                  : undefined,
              mannerisms: str('mannerisms'),
              relationships: str('relationships'),
              visualTags: str('visualTags')
            }
          : null
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildCharacterMasterSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildCharacterMasterUserPrompt({
                idea:
                  idea ||
                  (locale === 'en'
                    ? 'Polish and merge all fields'
                    : '全面潤飾並合併所有欄位'),
                storyTitle,
                styleNote,
                locale,
                existingDraft,
                soulContent: hasSoul ? soulContent : null
              })
            }
          ],
          max_tokens: 3000
        })
        const text = completion.choices[0]?.message.content ?? ''
        const profile = extractCharacterProfileJson(text)
        activity.append({
          kind: 'character',
          message: hasDraft || hasSoul ? 'aiRefine' : 'aiFill',
          storyId: payload.storyId,
          meta: {
            name: profile.name,
            usedSoul: hasSoul,
            usedDraft: hasDraft
          }
        })
        return {
          profile,
          profileJson: JSON.stringify(profile, null, 2),
          raw: text
        }
      }
    )
  )

  /** Generate local soul.md markdown from character profile fields (Gateway chat). */
  handle(
    'characters:generateSoul',
    (
      async (
        _e,
        payload: {
          storyId?: string
          locale?: 'zh-HK' | 'en'
          profile: Record<string, unknown>
          existingSoul?: string | null
          userRequest?: string | null
        }
      ) => {
        const spokenRaw = payload.profile?.spokenLanguages
        const spokenLanguages = Array.isArray(spokenRaw)
          ? spokenRaw.filter(
              (x): x is string => typeof x === 'string' && x.trim().length > 0
            )
          : undefined
        const str = (k: string): string | undefined => {
          const v = payload.profile?.[k]
          return typeof v === 'string' && v.trim() ? v.trim() : undefined
        }
        const profile = {
          name: str('name'),
          description: str('description'),
          appearance: str('appearance'),
          personality: str('personality'),
          backstory: str('backstory'),
          costume: str('costume'),
          ageRange: str('ageRange'),
          gender: str('gender'),
          voiceDesc: str('voiceDesc'),
          spokenLanguages,
          mannerisms: str('mannerisms'),
          relationships: str('relationships'),
          visualTags: str('visualTags')
        }
        const hasExistingSoul = Boolean(payload.existingSoul?.trim())
        if (!profileHasSoulSource(profile) && !hasExistingSoul) {
          throw new AppError(
            'VALIDATION',
            'Character profile is empty',
            'Fill name or appearance / personality first'
          )
        }
        // Soul from profile + existing soul + user request only.
        const locale = payload.locale ?? 'zh-HK'
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildSoulGenerateSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildSoulGenerateUserPrompt({
                profile,
                locale,
                existingSoul: payload.existingSoul,
                userRequest: payload.userRequest
              })
            }
          ],
          max_tokens: 4000
        })
        const raw = completion.choices[0]?.message.content ?? ''
        const content = normalizeSoulMarkdown(raw)
        if (!content || content.length < 40) {
          throw new AppError(
            'AI_FAILED',
            'Soul generation returned empty content',
            'Retry or fill more profile fields'
          )
        }
        // Persist draft under media/tmp so reload path works without Hub id
        const store = generation().getMediaStore()
        store.ensureTmpDir()
        const slug = (profile.name ?? 'character')
          .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
          .slice(0, 40)
        const filePath = store.tmpImagePath(`soul_${slug}`, '.md')
        writeFileSync(filePath, content, 'utf8')
        const title =
          extractNameFromSoulMd(content) || profile.name?.trim() || 'Soul'
        activity.append({
          kind: 'character',
          message: 'generateSoul',
          storyId: payload.storyId,
          meta: { title, path: filePath, chars: content.length }
        })
        return {
          content,
          filePath,
          title,
          raw
        }
      }
    )
  )

  handle(
    'characters:generateSheet',
    (
      async (
        _e,
        payload: {
          characterId: string
          variant?: string
          /** Prefer this gallery path as edit reference (still capped by API). */
          referenceImagePath?: string | null
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
          visualTags: row.visualTags ?? undefined
        }
        const { getSheetVariant } = await import(
          '../../src/domain/characterSheetVariants'
        )
        const { getArtStyle } = await import(
          '../../src/domain/characterArtStyles'
        )
        const { resolveSheetGenMode } = await import(
          '../../src/domain/characterMasterPrompt'
        )
        const variantDef = getSheetVariant(payload.variant)
        const variant = variantDef.id
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        // Sizes / enhance from Settings (all have defaults)
        const {
          aspectFromImageSize,
          imageSizeForSheetVariant
        } = await import('../../src/types/settings')
        const size = imageSizeForSheetVariant(settings, variant)
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
        // Only use a ref when UI explicitly requests identity edit (do not auto-pick gallery[0])
        const explicitRef =
          !forcePureLayout &&
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const hasValidRef = Boolean(refPath)
        const usedEdit =
          !forcePureLayout &&
          resolveSheetGenMode({
            useIdentityEdit: payload.useIdentityEdit,
            hasValidRef
          }) === 'edit'
        const prompt = usedEdit
          ? buildCharacterSheetEditPrompt(profile, variant, artStyle)
          : buildCharacterSheetImagePrompt(profile, variant, artStyle)

        // Persist style before long gen so reload/UI stay in sync
        if (payload.artStyle || row.artStyle !== artStyle) {
          await characters().update(row.id, { artStyle })
        }

        const img = usedEdit
          ? await aiClient.editImage({
              prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({
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
        const { enhanceCharacterImage } = await import(
          '../../src/infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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
        const primary = primaryGalleryPath(nextGallery)
        const updated = await characters().update(row.id, {
          refSheetPath: outPath,
          refImagePath: primary,
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
  handle(
    'characters:generateIntroVideo',
    (
      async (
        _e,
        payload: {
          characterId: string
          sourceImagePath: string
          durationSeconds?: number
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const row = await characters().get(payload.characterId)
        const sourceImagePath = payload.sourceImagePath?.trim()
        if (!sourceImagePath || !existsSync(sourceImagePath)) {
          throw new AppError(
            'VALIDATION',
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
            'Enable Grok gateway videoApi and use a key with agent/admin mode'
          )
        }

        let spokenLanguages: string[] | undefined
        try {
          const raw = (row as { spokenLanguages?: string | null }).spokenLanguages
          if (raw?.trim()) {
            const parsed = JSON.parse(raw) as unknown
            if (Array.isArray(parsed)) {
              spokenLanguages = parsed.filter(
                (x): x is string => typeof x === 'string'
              )
            }
          }
        } catch {
          spokenLanguages = undefined
        }

        // Load soul.md / hub as full performance bible (truncated for context).
        let soulExcerpt = ''
        try {
          const soulPath = (row as { soulMdPath?: string | null }).soulMdPath
          const soulHubId = (row as { soulHubId?: number | null }).soulHubId
          if (soulHubId != null || soulPath?.trim()) {
            const sr = await (async () => {
              if (soulHubId != null && Number.isFinite(soulHubId)) {
                const detail = await soulHub.getSoul(soulHubId)
                return SoulMdHubClient.flattenContent(
                  detail.content,
                  detail.file_type
                )
              }
              const path = soulPath!.trim()
              if (path.startsWith('soulmd-hub://')) {
                const id = Number(path.replace('soulmd-hub://', ''))
                if (!Number.isFinite(id)) return ''
                const detail = await soulHub.getSoul(id)
                return SoulMdHubClient.flattenContent(
                  detail.content,
                  detail.file_type
                )
              }
              if (existsSync(path)) {
                return readFileSync(path, 'utf-8')
              }
              return ''
            })()
            soulExcerpt = (sr ?? '').trim()
          }
        } catch {
          soulExcerpt = ''
        }

        const profile = {
          name: row.name,
          description: row.description,
          appearance: row.appearance ?? undefined,
          personality: row.personality ?? undefined,
          backstory: row.backstory ?? undefined,
          costume: row.costume ?? undefined,
          ageRange: row.ageRange ?? undefined,
          gender: row.gender ?? undefined,
          voiceDesc: row.voiceDesc ?? undefined,
          mannerisms: row.mannerisms ?? undefined,
          relationships: row.relationships ?? undefined,
          visualTags: row.visualTags ?? undefined,
          seedPrompt: (row as { seedPrompt?: string | null }).seedPrompt ?? undefined,
          artStyle: (row as { artStyle?: string | null }).artStyle ?? undefined,
          spokenLanguages
        }
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        const fallbackPrompt = buildCharacterIntroVideoPrompt(profile, locale, {
          soulExcerpt
        })
        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        const outPath = store.characterVideoPath(row.id, 'intro', '.mp4')
        const seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../../src/application/video/polishVideoPrompt')
        const {
          buildIntroVideoPolishUserPrompt,
          truncateForVideoPrompt
        } = await import('../../src/domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
          polishUserContent: buildIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: true,
            fallbackPrompt,
            name: profile.name,
            description: profile.description,
            appearance: profile.appearance,
            personality: profile.personality,
            backstory: profile.backstory,
            costume: profile.costume,
            ageRange: profile.ageRange,
            gender: profile.gender,
            voiceDesc: profile.voiceDesc,
            mannerisms: profile.mannerisms,
            relationships: profile.relationships,
            visualTags: profile.visualTags,
            artStyle: profile.artStyle,
            seedPrompt: profile.seedPrompt,
            spokenLanguages: profile.spokenLanguages,
            soulExcerpt: truncateForVideoPrompt(soulExcerpt)
          }),
          videoRequest: {
            durationSeconds: seconds,
            refImagePath: sourceImagePath,
            outputPath: outPath,
            aspectRatio
          }
        })

        const gallery = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath,
          refSheetPath: row.refSheetPath
        })
        const nextGallery = setGalleryIntroVideo(
          gallery,
          sourceImagePath,
          result.outputPath
        )
        const updated = await characters().update(row.id, {
          refGalleryJson: serializeCharacterGallery(nextGallery)
        })
        activity.append({
          kind: 'character',
          message: 'generateIntroVideo',
          meta: {
            characterId: row.id,
            sourceImagePath,
            path: result.outputPath,
            seconds,
            degraded: result.degraded ?? false,
            polished: result.polished,
            promptPreview: result.promptUsed.slice(0, 200)
          }
        })
        return {
          character: updated,
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

  /** Promote a draft sheet into the character gallery (after user confirms). */
  handle(
    'characters:commitSheet',
    (
      async (
        _e,
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
          throw new AppError('NOT_FOUND', 'Draft sheet file not found')
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
        const { getSheetVariant, isSheetVariantId } = await import(
          '../../src/domain/characterSheetVariants'
        )
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
          } = await import('../../src/domain/characterCostumes')
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
  handle(
    'characters:swapCostume',
    (
      async (
        _e,
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
            'Costume description is required for costume swap'
          )
        }

        const {
          buildCostumeSwapPrompt,
          costumeSwapGalleryLabel,
          getCostumeSwapPose,
          pickBestBaseImage
        } = await import('../../src/domain/costumeSwap')
        const { getArtStyle } = await import(
          '../../src/domain/characterArtStyles'
        )
        const {
          aspectFromImageSize
        } = await import('../../src/types/settings')

        const gallery = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath,
          refSheetPath: row.refSheetPath
        })
        const picked = pickBestBaseImage(gallery, {
          ageRange: row.ageRange,
          preferredPath: payload.baseImagePath
        })
        if (!picked.item?.path || !existsSync(picked.item.path)) {
          throw new AppError(
            'VALIDATION',
            'No base image for costume swap. Generate a body nude, base-layer, or full-body sheet first.'
          )
        }
        const basePath = picked.item.path
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
            ? settings.imageSizeWide
            : pose.id === 'three_quarter'
              ? settings.imageSizeSquare
              : settings.imageSizeTall
        const aspectRatio = aspectFromImageSize(size)

        const img = await aiClient.editImage({
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

        const { enhanceCharacterImage } = await import(
          '../../src/infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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
              pickReason: picked.reason,
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
            pickReason: picked.reason,
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
            pickReason: picked.reason,
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
          pickReason: picked.reason,
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

  handle(
    'media:discardSheetDraft',
    (async (_e, filePath: string) => {
      const store = generation().getMediaStore()
      store.discardTmp(filePath)
      return { ok: true as const }
    })
  )

  // ─── SoulMD Hub (public catalogue) ─────────────────────────
  let soulIndexBuilding: Promise<unknown> | null = null
  const soulHub = new SoulMdHubClient()
  const userDataPath = (): string => app.getPath('userData')

  handle(
    'souls:list',
    (
      async (
        _e,
        opts?: { page?: number; limit?: number; q?: string; role?: string }
      ) => soulHub.listSouls({ ...opts, is_nft: 0 })
    )
  )
  handle(
    'souls:get',
    (async (_e, id: number) => {
      const detail = await soulHub.getSoul(id)
      const flat = SoulMdHubClient.flattenContent(
        detail.content,
        detail.file_type
      )
      return { ...detail, contentFlat: flat }
    })
  )
  handle(
    'souls:categories',
    (async () => soulHub.listCategories())
  )
  handle(
    'souls:ensureIndex',
    (async (_e, force?: boolean) => {
      const cached = SoulMdHubClient.loadCache(userDataPath())
      if (cached && !force && cached.items.length > 0) {
        return {
          fromCache: true,
          pages: cached.pages,
          count: cached.items.length,
          builtAt: cached.builtAt,
          suggestions: cached.suggestions
        }
      }
      if (!soulIndexBuilding) {
        soulIndexBuilding = soulHub
          .buildIndex(50)
          .then((idx) => {
            SoulMdHubClient.saveCache(userDataPath(), idx)
            return idx
          })
          .finally(() => {
            soulIndexBuilding = null
          })
      }
      const idx = (await soulIndexBuilding) as Awaited<
        ReturnType<SoulMdHubClient['buildIndex']>
      >
      return {
        fromCache: false,
        pages: idx.pages,
        count: idx.items.length,
        builtAt: idx.builtAt,
        suggestions: idx.suggestions
      }
    })
  )
  handle(
    'souls:suggestions',
    (async () => {
      const cached = SoulMdHubClient.loadCache(userDataPath())
      if (cached) return cached.suggestions
      return []
    })
  )
  handle(
    'souls:searchLocal',
    (async (_e, q: string, limit?: number) => {
      const cached = SoulMdHubClient.loadCache(userDataPath())
      if (!cached) return { items: [] as unknown[], fromCache: false }
      return {
        items: SoulMdHubClient.filterIndex(cached, q, limit ?? 24),
        fromCache: true
      }
    })
  )
  handle(
    'characters:importSoulMd',
    (async () => {
      const win = getMainWindow()
      const options: OpenDialogOptions = {
        title: 'Import soul.md',
        filters: [{ name: 'Markdown', extensions: ['md'] }],
        properties: ['openFile']
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)

      if (result.canceled || result.filePaths.length === 0) return null

      const filePath = result.filePaths[0]
      if (!existsSync(filePath) || !isSoulMdPath(filePath)) {
        throw new AppError('VALIDATION', 'Selected file must be a .md soul file')
      }
      const content = readFileSync(filePath, 'utf-8')
      return { filePath, content }
    })
  )

  /**
   * Load full soul.md text for display in the editor.
   * Supports local filesystem paths and soulmd-hub://{id}.
   */
  handle(
    'characters:readSoulContent',
    (
      async (
        _e,
        payload: {
          soulMdPath?: string | null
          soulHubId?: number | null
        }
      ) => {
        if (payload.soulHubId != null && Number.isFinite(payload.soulHubId)) {
          const detail = await soulHub.getSoul(payload.soulHubId)
          const flat = SoulMdHubClient.flattenContent(
            detail.content,
            detail.file_type
          )
          return {
            source: 'hub' as const,
            id: detail.id,
            title: detail.title,
            content: flat || ''
          }
        }
        const path = payload.soulMdPath?.trim()
        if (!path) {
          return { source: 'none' as const, content: '' }
        }
        if (path.startsWith('soulmd-hub://')) {
          const id = Number(path.replace('soulmd-hub://', ''))
          if (!Number.isFinite(id)) {
            throw new AppError('VALIDATION', 'Invalid soulmd-hub id')
          }
          const detail = await soulHub.getSoul(id)
          const flat = SoulMdHubClient.flattenContent(
            detail.content,
            detail.file_type
          )
          return {
            source: 'hub' as const,
            id: detail.id,
            title: detail.title,
            content: flat || ''
          }
        }
        if (!existsSync(path)) {
          throw new AppError('NOT_FOUND', `soul.md not found: ${path}`)
        }
        const content = readFileSync(path, 'utf-8')
        return {
          source: 'file' as const,
          path,
          content
        }
      }
    )
  )

  /**
   * Persist soul.md text the user edited in the character form.
   * Reuses a local path when possible; otherwise writes under media/tmp.
   */
  handle(
    'characters:writeSoulContent',
    (
      async (
        _e,
        payload: {
          content: string
          filePath?: string | null
          characterId?: string | null
        }
      ) => {
        const content = payload.content ?? ''
        const store = generation().getMediaStore()
        store.ensureTmpDir()
        let dest = payload.filePath?.trim() || ''
        // Hub pseudo-paths and missing files → new local file
        if (
          !dest ||
          dest.startsWith('soulmd-hub://') ||
          dest.startsWith('http://') ||
          dest.startsWith('https://') ||
          !existsSync(dest)
        ) {
          const slug = (payload.characterId || 'character')
            .replace(/[^\w\u4e00-\u9fff-]+/g, '_')
            .slice(0, 40)
          dest = store.tmpImagePath(`soul_edit_${slug}`, '.md')
        }
        writeFileSync(dest, content, 'utf8')
        activity.append({
          kind: 'character',
          message: 'writeSoulContent',
          meta: { path: dest, chars: content.length }
        })
        return { filePath: dest, content }
      }
    )
  )

  handle(
    'characters:importSoulMdUrl',
    (async (_e, url: string) => {
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        throw new AppError('VALIDATION', 'URL must start with http:// or https://')
      }
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
      if (!res.ok) {
        throw new AppError('IO', `Failed to fetch soul.md (${res.status})`)
      }
      const content = await res.text()
      const doc = parseSoulMd(content)
      return {
        url,
        content,
        name: doc.title ?? extractNameFromSoulMd(content),
        description: extractDescriptionFromSoulMd(content),
        parsed: doc
      }
    })
  )

  // ─── Scenes ────────────────────────────────────────────────
  handle(
    'scenes:list',
    (
      async (
        _e,
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
  handle(
    'scenes:create',
    (async (_e, input: CreateSceneInput) => scenes().create(input))
  )
  handle(
    'scenes:update',
    (async (_e, id: string, data: UpdateSceneInput) => scenes().update(id, data))
  )
  handle(
    'scenes:delete',
    (async (_e, id: string) => scenes().delete(id))
  )

  handle(
    'scenes:aiFill',
    (
      async (
        _e,
        payload: {
          idea?: string
          storyId?: string
          /** all | scene:<id> | beat:<timelineEntryId> */
          segmentKey?: string | null
          locale?: 'zh-HK' | 'en'
          existingDraft?: Record<string, string | undefined | null>
          suggestFromStory?: boolean
          sceneNumber?: number
        }
      ) => {
        const {
          buildSceneMasterSystemPrompt,
          buildSceneMasterUserPrompt,
          buildSceneSuggestFromStoryUserPrompt,
          extractSceneProfileJson
        } = await import('../../src/domain/sceneMasterPrompt')
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
        if (!idea && !hasDraft && !payload.suggestFromStory) {
          throw new AppError(
            'VALIDATION',
            'Idea, draft, or suggestFromStory is required'
          )
        }
        if (payload.suggestFromStory && !payload.storyId?.trim()) {
          throw new AppError('VALIDATION', 'storyId is required for suggestFromStory')
        }
        // Pure invent-from-idea: only user idea (+ empty form). Inject story
        // cast/style only when refining a draft or explicitly suggesting from story.
        const { shouldInjectStoryContext } = await import(
          '../../src/domain/storyContextPolicy'
        )
        const injectStoryContext = shouldInjectStoryContext({
          hasDraft,
          suggestFromStory: Boolean(payload.suggestFromStory)
        })
        if (payload.storyId && injectStoryContext) {
          const story = await getPrisma().story.findUnique({
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
            throw new AppError('NOT_FOUND', `Story not found: ${payload.storyId}`)
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
                  'Scene not linked to this story'
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
                throw new AppError('VALIDATION', 'Timeline beat not found')
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
              throw new AppError('VALIDATION', `Unknown segmentKey: ${seg}`)
            }
          }
        }
        const userContent = payload.suggestFromStory
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
          : buildSceneMasterUserPrompt({
              idea: idea || (locale === 'en' ? 'Polish' : '全面潤飾'),
              storyTitle,
              styleNote,
              locale,
              characterSnippets,
              propSnippets,
              priorSceneSnippets,
              existingDraft: hasDraft
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
                : null
            })
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildSceneMasterSystemPrompt(locale)
            },
            { role: 'user', content: userContent }
          ],
          max_tokens: 2500
        })
        const text = completion.choices[0]?.message.content ?? ''
        const profile = extractSceneProfileJson(text)
        activity.append({
          kind: 'scene',
          message: payload.suggestFromStory
            ? 'suggestScene'
            : hasDraft
              ? 'aiRefineScene'
              : 'aiFillScene',
          storyId: payload.storyId,
          meta: {
            title: profile.title,
            segmentKey: payload.segmentKey ?? null
          }
        })
        return {
          profile,
          profileJson: JSON.stringify(profile, null, 2),
          raw: text
        }
      }
    )
  )

  handle(
    'scenes:generatePlate',
    (
      async (
        _e,
        payload: {
          sceneId: string
          variant?: string
          referenceImagePath?: string | null
          useIdentityEdit?: boolean
          persist?: boolean
          artStyle?: string | null
        }
      ) => {
        const row = await scenes().get(payload.sceneId)
        const persist = payload.persist === true
        const {
          buildScenePlateEditPrompt,
          buildScenePlateImagePrompt,
          getScenePlateVariant
        } = await import('../../src/domain/scenePlateVariants')
        const { getArtStyle } = await import(
          '../../src/domain/characterArtStyles'
        )
        const {
          appendSceneGalleryItem,
          MAX_SCENE_IMAGE_EDIT_REFERENCES,
          parseSceneGallery,
          pickSceneReferencePaths,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../../src/domain/sceneGallery')
        const {
          aspectFromImageSize,
          imageSizeForScenePlate
        } = await import('../../src/types/settings')

        const variantDef = getScenePlateVariant(payload.variant)
        const variant = variantDef.id
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        const size = imageSizeForScenePlate(settings, variant)
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
          visualTags: row.visualTags ?? undefined
        }
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const explicitRef =
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const { resolveSheetGenMode } = await import(
          '../../src/domain/characterMasterPrompt'
        )
        const usedEdit =
          resolveSheetGenMode({
            useIdentityEdit: payload.useIdentityEdit,
            hasValidRef: Boolean(refPath)
          }) === 'edit'
        const prompt = usedEdit
          ? buildScenePlateEditPrompt(profile, variant, artStyle)
          : buildScenePlateImagePrompt(profile, variant, artStyle)

        if (payload.artStyle || row.artStyle !== artStyle) {
          await scenes().update(row.id, { artStyle })
        }

        const img = usedEdit
          ? await aiClient.editImage({
              prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({
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
          '../../src/infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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
  handle(
    'scenes:generateIntroVideo',
    (
      async (
        _e,
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
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
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
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../../src/application/video/polishVideoPrompt')
        const {
          buildSceneIntroVideoPolishUserPrompt
        } = await import('../../src/domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
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
              (row as { seedPrompt?: string | null }).seedPrompt ?? undefined
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
        } = await import('../../src/domain/sceneGallery')
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

  handle(
    'scenes:commitPlate',
    (
      async (
        _e,
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
          throw new AppError('NOT_FOUND', 'Draft plate file not found')
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
        } = await import('../../src/domain/sceneGallery')
        const { getScenePlateVariant, isScenePlateVariantId } = await import(
          '../../src/domain/scenePlateVariants'
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
          } = await import('../../src/domain/sceneLooks')
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

  handle(
    'scenes:swapAtmosphere',
    (
      async (
        _e,
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
            'Atmosphere description is required'
          )
        }
        const {
          buildAtmosphereSwapPrompt,
          atmosphereGalleryLabel,
          getAtmospherePose,
          pickBestSceneBaseImage
        } = await import('../../src/domain/sceneAtmosphere')
        const { getArtStyle } = await import(
          '../../src/domain/characterArtStyles'
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../../src/domain/sceneGallery')
        const { aspectFromImageSize } = await import('../../src/types/settings')

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
            'No base plate for atmosphere swap. Generate an establishing or hero plate first.'
          )
        }
        const basePath = picked.item.path
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        const pose = getAtmospherePose(payload.pose)
        const prompt = buildAtmosphereSwapPrompt({
          title: row.title ?? undefined,
          description: row.description,
          atmosphereDescription,
          artStyle,
          pose: pose.id,
          setDressing: row.setDressing,
          visualTags: row.visualTags
        })
        const size =
          pose.id === 'detail'
            ? settings.imageSizeSquare
            : settings.imageSizeWide
        const aspectRatio = aspectFromImageSize(size)
        const img = await aiClient.editImage({
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
          '../../src/infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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
  handle(
    'scenes:copyGalleryFrom',
    (
      async (
        _e,
        payload: { targetSceneId: string; sourceSceneId: string }
      ) => {
        const target = await scenes().get(payload.targetSceneId)
        const source = await scenes().get(payload.sourceSceneId)
        const {
          parseSceneGallery,
          serializeSceneGallery,
          primarySceneGalleryPath
        } = await import('../../src/domain/sceneGallery')
        const srcGallery = parseSceneGallery(source.refGalleryJson, {
          refImagePath: source.refImagePath
        })
        if (srcGallery.length === 0) {
          throw new AppError('VALIDATION', 'Source scene has no gallery images')
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

  // ─── Story cast (M2M link/unlink) ──────────────────────────
  const cast = (): StoryCastService => new StoryCastService(getPrisma())
  handle(
    'stories:linkCharacter',
    (
      async (
        _e,
        payload: {
          storyId: string
          characterId: string
          roleNote?: string
          costumeId?: string | null
        }
      ) =>
        cast().linkCharacter(payload.storyId, payload.characterId, {
          roleNote: payload.roleNote,
          costumeId: payload.costumeId
        })
    )
  )
  handle(
    'stories:setCharacterCostume',
    (
      async (
        _e,
        payload: {
          storyId: string
          characterId: string
          costumeId: string | null
        }
      ) =>
        cast().setCharacterCostume(
          payload.storyId,
          payload.characterId,
          payload.costumeId
        )
    )
  )
  handle(
    'stories:unlinkCharacter',
    (
      async (_e, payload: { storyId: string; characterId: string }) =>
        cast().unlinkCharacter(payload.storyId, payload.characterId)
    )
  )
  handle(
    'stories:linkScene',
    (
      async (
        _e,
        payload: { storyId: string; sceneId: string; sceneNumber?: number }
      ) =>
        cast().linkScene(payload.storyId, payload.sceneId, {
          sceneNumber: payload.sceneNumber
        })
    )
  )
  handle(
    'stories:unlinkScene',
    (
      async (_e, payload: { storyId: string; sceneId: string }) =>
        cast().unlinkScene(payload.storyId, payload.sceneId)
    )
  )
  handle(
    'stories:linkProp',
    (
      async (_e, payload: { storyId: string; propId: string }) =>
        cast().linkProp(payload.storyId, payload.propId)
    )
  )
  handle(
    'stories:unlinkProp',
    (
      async (_e, payload: { storyId: string; propId: string }) =>
        cast().unlinkProp(payload.storyId, payload.propId)
    )
  )
  handle(
    'stories:listCast',
    (async (_e, storyId: string) => {
      const c = cast()
      return {
        characters: await c.listCharactersForStory(storyId),
        scenes: await c.listScenesForStory(storyId),
        props: await c.listPropsForStory(storyId)
      }
    })
  )

  // ─── Props ─────────────────────────────────────────────────
  handle(
    'props:list',
    (
      async (
        _e,
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
  handle(
    'props:create',
    (async (_e, input: CreatePropInput) => props().create(input))
  )
  handle(
    'props:update',
    (async (_e, id: string, data: UpdatePropInput) => props().update(id, data))
  )
  handle(
    'props:delete',
    (async (_e, id: string) => props().delete(id))
  )

  handle(
    'props:aiFill',
    (
      async (
        _e,
        payload: {
          idea?: string
          storyId?: string
          locale?: 'zh-HK' | 'en'
          existingDraft?: Record<string, string | undefined | null>
        }
      ) => {
        const {
          buildPropMasterSystemPrompt,
          buildPropMasterUserPrompt,
          extractPropProfileJson
        } = await import('../../src/domain/propMasterPrompt')
        const locale = payload.locale ?? 'zh-HK'
        const draft = payload.existingDraft
        const hasDraft = Boolean(
          draft &&
            Object.values(draft).some((v) => typeof v === 'string' && v.trim())
        )
        const idea = payload.idea?.trim() ?? ''
        if (!idea && !hasDraft) {
          throw new AppError('VALIDATION', 'Idea or draft required')
        }
        // Pure invent-from-idea: skip active story style (Demo rain etc.)
        const { shouldInjectStoryContext } = await import(
          '../../src/domain/storyContextPolicy'
        )
        let storyTitle: string | undefined
        let styleNote: string | null | undefined
        if (
          payload.storyId &&
          shouldInjectStoryContext({ hasDraft })
        ) {
          const story = await getPrisma().story.findUnique({
            where: { id: payload.storyId }
          })
          storyTitle = story?.title
          styleNote = story?.styleNote
        }
        const completion = await aiClient.chat({
          messages: [
            {
              role: 'system',
              content: buildPropMasterSystemPrompt(locale)
            },
            {
              role: 'user',
              content: buildPropMasterUserPrompt({
                idea: idea || (locale === 'en' ? 'Polish' : '全面潤飾'),
                storyTitle,
                styleNote,
                locale,
                existingDraft: hasDraft
                  ? {
                      name: draft?.name ?? undefined,
                      description: draft?.description ?? undefined,
                      material: draft?.material ?? undefined,
                      sizeNotes: draft?.sizeNotes ?? undefined,
                      condition: draft?.condition ?? undefined,
                      visualTags: draft?.visualTags ?? undefined,
                      artStyle: draft?.artStyle ?? undefined
                    }
                  : null
              })
            }
          ],
          max_tokens: 1500
        })
        const text = completion.choices[0]?.message.content ?? ''
        const profile = extractPropProfileJson(text)
        activity.append({
          kind: 'prop',
          message: hasDraft ? 'aiRefineProp' : 'aiFillProp',
          storyId: payload.storyId,
          meta: { name: profile.name }
        })
        return {
          profile,
          profileJson: JSON.stringify(profile, null, 2),
          raw: text
        }
      }
    )
  )

  handle(
    'props:generatePlate',
    (
      async (
        _e,
        payload: {
          propId: string
          variant?: string
          referenceImagePath?: string | null
          useIdentityEdit?: boolean
          persist?: boolean
          artStyle?: string | null
        }
      ) => {
        const row = await props().get(payload.propId)
        const {
          buildPropPlateEditPrompt,
          buildPropPlateImagePrompt,
          getPropPlateVariant
        } = await import('../../src/domain/propPlateVariants')
        const { getArtStyle } = await import(
          '../../src/domain/characterArtStyles'
        )
        const { resolveSheetGenMode } = await import(
          '../../src/domain/characterMasterPrompt'
        )
        const {
          appendSceneGalleryItem,
          parseSceneGallery,
          primarySceneGalleryPath,
          serializeSceneGallery
        } = await import('../../src/domain/sceneGallery')
        const {
          aspectFromImageSize,
          imageSizeForPropPlate
        } = await import('../../src/types/settings')

        const variantDef = getPropPlateVariant(payload.variant)
        const variant = variantDef.id
        const artStyle = getArtStyle(
          payload.artStyle ?? row.artStyle ?? undefined
        ).id
        const size = imageSizeForPropPlate(settings, variant)
        const aspectRatio = aspectFromImageSize(size)
        const profile = {
          name: row.name,
          description: row.description,
          material: row.material ?? undefined,
          sizeNotes: row.sizeNotes ?? undefined,
          condition: row.condition ?? undefined,
          visualTags: row.visualTags ?? undefined
        }
        const gallery = parseSceneGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const explicitRef =
          typeof payload.referenceImagePath === 'string' &&
          payload.referenceImagePath.trim()
            ? payload.referenceImagePath.trim()
            : null
        const refPath =
          explicitRef && existsSync(explicitRef) ? explicitRef : null
        const usedEdit =
          resolveSheetGenMode({
            useIdentityEdit: payload.useIdentityEdit,
            hasValidRef: Boolean(refPath)
          }) === 'edit'
        const prompt = usedEdit
          ? buildPropPlateEditPrompt(profile, variant, artStyle)
          : buildPropPlateImagePrompt(profile, variant, artStyle)
        if (payload.artStyle || row.artStyle !== artStyle) {
          await props().update(row.id, { artStyle })
        }
        const img = usedEdit
          ? await aiClient.editImage({
              prompt,
              imagePath: refPath!,
              size,
              aspectRatio
            })
          : await aiClient.generateImage({ prompt, size, aspectRatio })
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
          '../../src/infrastructure/media/imageEnhance'
        )
        const enhanced = enhanceCharacterImage(outPath, {
          enabled: settings.imageEnhance,
          maxEdge: settings.imageEnhanceMaxEdge,
          scale: settings.imageEnhanceScale
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
  handle(
    'props:generateIntroVideo',
    (
      async (
        _e,
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
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
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
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../../src/application/video/polishVideoPrompt')
        const {
          buildPropIntroVideoPolishUserPrompt
        } = await import('../../src/domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
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
              (row as { seedPrompt?: string | null }).seedPrompt ?? undefined
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
        } = await import('../../src/domain/sceneGallery')
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

  handle(
    'props:commitPlate',
    (
      async (
        _e,
        payload: {
          propId: string
          path: string
          variant?: string
          label?: string
        }
      ) => {
        const row = await props().get(payload.propId)
        if (!payload.path || !existsSync(payload.path)) {
          throw new AppError('NOT_FOUND', 'Draft prop plate not found')
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
        } = await import('../../src/domain/sceneGallery')
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

  // ─── Costumes (global wardrobe) ─────────────────────────────
  handle(
    'costumes:list',
    (
      async (
        _e,
        opts?: { q?: string; characterId?: string; unlinkedOnly?: boolean }
      ) => costumes().list(opts)
    )
  )
  handle(
    'costumes:get',
    (async (_e, id: string) => costumes().get(id))
  )
  handle(
    'costumes:create',
    (
      async (
        _e,
        input: {
          name: string
          description: string
          artStyle?: string | null
          refImagePath?: string | null
          characterIds?: string[]
        }
      ) => costumes().create(input)
    )
  )
  handle(
    'costumes:update',
    (
      async (
        _e,
        id: string,
        data: {
          name?: string
          description?: string
          artStyle?: string | null
          refImagePath?: string | null
          characterIds?: string[]
        }
      ) => costumes().update(id, data)
    )
  )
  handle(
    'costumes:delete',
    (async (_e, id: string) => costumes().delete(id))
  )
  handle(
    'costumes:linkCharacter',
    (
      async (_e, payload: { costumeId: string; characterId: string }) =>
        costumes().linkCharacter(payload.costumeId, payload.characterId)
    )
  )
  handle(
    'costumes:unlinkCharacter',
    (
      async (_e, payload: { costumeId: string; characterId: string }) =>
        costumes().unlinkCharacter(payload.costumeId, payload.characterId)
    )
  )
  handle(
    'costumes:setActive',
    (
      async (_e, payload: { costumeId: string; characterId: string }) =>
        costumes().setActiveOnCharacter(payload.costumeId, payload.characterId)
    )
  )
  handle(
    'costumes:listForCharacter',
    (async (_e, characterId: string) => {
      const list = await costumes().list({ characterId })
      const char = await characters().get(characterId)
      const active = (char.costume ?? '').trim().toLowerCase()
      return list.map((c) => ({
        ...c,
        isActive:
          Boolean(active) &&
          c.description.trim().toLowerCase() === active,
        dressedImagePath:
          c.characterLinks.find((l) => l.characterId === characterId)
            ?.dressedImagePath ?? null
      }))
    })
  )
  /** AI invent / polish costume name + wardrobe description. */
  handle(
    'costumes:aiFill',
    (
      async (
        _e,
        payload: {
          idea?: string
          locale?: 'zh-HK' | 'en'
          existingDraft?: {
            name?: string | null
            description?: string | null
            artStyle?: string | null
          }
        }
      ) => {
        const locale = payload.locale ?? 'zh-HK'
        const draft = payload.existingDraft
        const hasDraft = Boolean(
          draft &&
            ((draft.name && draft.name.trim()) ||
              (draft.description && draft.description.trim()))
        )
        const idea = payload.idea?.trim() ?? ''
        if (!idea && !hasDraft) {
          throw new AppError('VALIDATION', 'Idea or draft required')
        }
        const system =
          locale === 'en'
            ? 'You are a film wardrobe designer. Reply with ONLY compact JSON: {"name":"short label","description":"full wardrobe description for image gen (layers, fabric, colors, accessories; no brand logos)","artStyle":"optional style id or null"}. No markdown.'
            : '你是影視造型指導。只回覆緊湊 JSON：{"name":"短名稱","description":"完整戲服描述（分層、布料、顏色、配飾；無品牌 Logo）","artStyle":"可選風格 id 或 null"}。不要 markdown。'
        const userParts = [
          idea
            ? locale === 'en'
              ? `Idea: ${idea}`
              : `構思：${idea}`
            : locale === 'en'
              ? 'Polish the draft wardrobe.'
              : '潤飾以下戲服草稿。',
          hasDraft
            ? `Draft:\nname: ${draft?.name ?? ''}\ndescription: ${draft?.description ?? ''}\nartStyle: ${draft?.artStyle ?? ''}`
            : null
        ].filter(Boolean)
        const completion = await aiClient.chat({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userParts.join('\n\n') }
          ],
          max_tokens: 900
        })
        const text = completion.choices[0]?.message.content ?? ''
        let name = ''
        let description = ''
        let artStyle: string | null = null
        try {
          const m = text.match(/\{[\s\S]*\}/)
          if (m) {
            const j = JSON.parse(m[0]) as {
              name?: string
              description?: string
              artStyle?: string | null
            }
            name = (j.name ?? '').trim()
            description = (j.description ?? '').trim()
            artStyle = j.artStyle?.trim() || null
          }
        } catch {
          /* fall through */
        }
        if (!description) {
          description = text.trim().slice(0, 2000)
        }
        if (!name) {
          name = description.slice(0, 32) || (locale === 'en' ? 'Look' : '造型')
        }
        activity.append({
          kind: 'costume',
          message: hasDraft ? 'aiRefineCostume' : 'aiFillCostume',
          meta: { name }
        })
        return { name, description, artStyle, raw: text }
      }
    )
  )

  /**
   * Dress a character in this costume using character ref images (identity lock).
   * Reuses characters:swapCostume pipeline; stores dressed path on the join.
   */
  handle(
    'costumes:generateDressed',
    (
      async (
        _e,
        payload: {
          costumeId: string
          characterId: string
          baseImagePath?: string | null
          pose?: string | null
        }
      ) => {
        const cos = await costumes().get(payload.costumeId)
        // Ensure link exists
        await costumes().linkCharacter(payload.costumeId, payload.characterId)
        // Invoke same logic as swapCostume by calling the service path inline
        // (duplicate thin wrapper around IPC handler internals)
        const row = await characters().get(payload.characterId)
        const costumeDescription = cos.description.trim()
        const {
          buildCostumeSwapPrompt,
          costumeSwapGalleryLabel,
          getCostumeSwapPose,
          pickBestBaseImage
        } = await import('../../src/domain/costumeSwap')
        const { getArtStyle } = await import(
          '../../src/domain/characterArtStyles'
        )
        const { aspectFromImageSize } = await import(
          '../../src/types/settings'
        )
        const {
          appendGalleryItem,
          parseCharacterGallery,
          serializeCharacterGallery
        } = await import('../../src/domain/characterGallery')

        const gallery = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath,
          refSheetPath: row.refSheetPath
        })
        const picked = pickBestBaseImage(gallery, {
          ageRange: row.ageRange,
          preferredPath: payload.baseImagePath
        })
        if (!picked.item?.path || !existsSync(picked.item.path)) {
          throw new AppError(
            'VALIDATION',
            'No base image for costume dress. Generate a character reference sheet first.'
          )
        }
        const basePath = picked.item.path
        const artStyle = getArtStyle(
          cos.artStyle ?? row.artStyle ?? undefined
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
        const size =
          pose.id === 'turnaround'
            ? settings.imageSizeWide
            : pose.id === 'three_quarter'
              ? settings.imageSizeSquare
              : settings.imageSizeTall
        const aspectRatio = aspectFromImageSize(size)
        const img = await aiClient.editImage({
          prompt,
          imagePath: basePath,
          size,
          aspectRatio
        })
        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        const outPath = store.characterImagePath(
          row.id,
          'costume_dressed',
          '.png'
        )
        writeFileSync(outPath, Buffer.from(img.b64, 'base64'))
        const label = costumeSwapGalleryLabel(costumeDescription)
        const nextGallery = appendGalleryItem(gallery, {
          path: outPath,
          kind: 'gen',
          label,
          layer: 'costume'
        })
        await characters().update(row.id, {
          refGalleryJson: serializeCharacterGallery(nextGallery),
          refImagePath: row.refImagePath || outPath
        })
        await costumes().setDressedImage(
          payload.costumeId,
          payload.characterId,
          outPath
        )
        // Also update costume hero plate if empty
        if (!cos.refImagePath) {
          await costumes().update(payload.costumeId, {
            refImagePath: outPath
          })
        }
        activity.append({
          kind: 'costume',
          message: 'generateDressed',
          meta: {
            costumeId: payload.costumeId,
            characterId: payload.characterId,
            path: outPath
          }
        })
        return {
          path: outPath,
          costume: await costumes().get(payload.costumeId),
          characterId: payload.characterId
        }
      }
    )
  )

  /**
   * Image → costume look intro video for one gallery still.
   * Uses costume description; wardrobe locked to the source still.
   */
  handle(
    'costumes:generateIntroVideo',
    (
      async (
        _e,
        payload: {
          costumeId: string
          sourceImagePath: string
          durationSeconds?: number
          locale?: 'zh-HK' | 'en'
        }
      ) => {
        const row = await costumes().get(payload.costumeId)
        const sourceImagePath = payload.sourceImagePath?.trim()
        if (!sourceImagePath || !existsSync(sourceImagePath)) {
          throw new AppError(
            'VALIDATION',
            'Source image is required',
            'Select a reference still first'
          )
        }
        if (!aiClient.generateVideo) {
          throw new AppError(
            'AI_UNAVAILABLE',
            'Video generation is not available',
            'Enable Grok gateway videoApi and use a key with agent/admin mode'
          )
        }

        const profile = {
          name: row.name,
          description: row.description || row.name,
          artStyle: row.artStyle ?? undefined
        }
        const locale = payload.locale === 'en' ? 'en' : 'zh-HK'
        const fallbackPrompt = buildCostumeIntroVideoPrompt(profile, locale)
        const store = generation().getMediaStore()
        store.ensureLibraryDirs()
        const outPath = store.costumeVideoPath(row.id, 'intro', '.mp4')
        const seconds =
          typeof payload.durationSeconds === 'number'
            ? payload.durationSeconds
            : 10
        const aspectRatio =
          settings.aspectRatio === '9:16' || settings.aspectRatio === '16:9'
            ? settings.aspectRatio
            : '16:9'

        const {
          polishThenGenerateVideo
        } = await import('../../src/application/video/polishVideoPrompt')
        const {
          buildCostumeIntroVideoPolishUserPrompt
        } = await import('../../src/domain/videoPromptPolish')

        const result = await polishThenGenerateVideo({
          ai: aiClient,
          locale,
          fallbackPrompt,
          polishUserContent: buildCostumeIntroVideoPolishUserPrompt({
            locale,
            seconds,
            aspectRatio,
            hasRefImage: true,
            fallbackPrompt,
            name: profile.name,
            description: profile.description,
            artStyle: profile.artStyle
          }),
          videoRequest: {
            durationSeconds: seconds,
            refImagePath: sourceImagePath,
            outputPath: outPath,
            aspectRatio
          }
        })

        const gallery = parseCharacterGallery(row.refGalleryJson, {
          refImagePath: row.refImagePath
        })
        const nextGallery = setGalleryIntroVideo(
          gallery,
          sourceImagePath,
          result.outputPath
        )
        const updated = await costumes().update(row.id, {
          refGalleryJson: serializeCharacterGallery(nextGallery)
        })
        activity.append({
          kind: 'costume',
          message: 'generateIntroVideo',
          meta: {
            costumeId: row.id,
            sourceImagePath,
            path: result.outputPath,
            seconds,
            degraded: result.degraded ?? false,
            polished: result.polished,
            promptPreview: result.promptUsed.slice(0, 200)
          }
        })
        return {
          costume: updated,
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

  // ─── Timeline ──────────────────────────────────────────────
  handle(
    'timeline:list',
    (async (_e, storyId: string) => timeline().list(storyId))
  )
  handle(
    'timeline:create',
    (async (_e, input: CreateTimelineEntryInput) => timeline().create(input))
  )
  handle(
    'timeline:update',
    (async (_e, id: string, data: UpdateTimelineEntryInput) =>
      timeline().update(id, data)
    )
  )
  handle(
    'timeline:delete',
    (async (_e, id: string) => timeline().delete(id))
  )
  handle(
    'timeline:reorder',
    (async (_e, storyId: string, orderedIds: string[]) =>
      timeline().reorder(storyId, orderedIds)
    )
  )

  handle(
    'timeline:setMedia',
    (
      async (
        _e,
        id: string,
        data: {
          mediaPath?: string | null
          mediaStatus: 'EMPTY' | 'QUEUED' | 'GENERATING' | 'READY' | 'FAILED'
          mediaError?: string | null
        }
      ) => timeline().setMedia(id, data)
    )
  )

  // ─── Generation ────────────────────────────────────────────
  handle(
    'generation:run',
    (
      async (
        event,
        storyId: string,
        opts?: { onlyFailedVideos?: boolean }
      ) => {
        activity.append({
          kind: 'generation',
          message: opts?.onlyFailedVideos ? 'retry failed' : 'run pipeline',
          storyId
        })
        const result = await generation().run(
          storyId,
          (payload) => {
            event.sender.send('generation:progress', payload)
          },
          opts
        )
        const degraded = result.steps.some((s) => s.degraded)
        settingsStore.save({ lastGenerationDegraded: degraded })
        activity.append({
          kind: 'generation',
          message: result.success ? 'pipeline ok' : 'pipeline failed',
          storyId,
          meta: { degraded, steps: result.steps.length }
        })
        return result
      }
    )
  )

  handle(
    'generation:cancel',
    (async () => {
      generation().cancel()
      activity.append({ kind: 'generation', message: 'cancelled' })
      return { ok: true as const }
    })
  )

  handle(
    'generation:runClip',
    (async (
      event,
      storyId: string,
      entryId: string,
      opts?: { revisionPrompt?: string | null }
    ) => {
      activity.append({
        kind: 'generation',
        message: 'run clip',
        storyId,
        meta: {
          entryId,
          hasRevision: Boolean(opts?.revisionPrompt?.trim())
        }
      })
      const result = await generation().generateClip(
        storyId,
        entryId,
        (payload) => {
          event.sender.send('generation:progress', payload)
        },
        opts
      )
      if (result.degraded) {
        settingsStore.save({ lastGenerationDegraded: true })
      }
      activity.append({
        kind: 'generation',
        message: result.degraded ? 'clip stub' : 'clip ok',
        storyId,
        meta: { entryId }
      })
      return result
    })
  )

  handle(
    'ai:status',
    (async () => aiClient.getStatus())
  )

  // ─── Local Grok Gateway (gctoac) lifecycle ─────────────────
  handle('gateway:status', async () => {
    const {
      getGrokGatewayService
    } = await import('../../src/infrastructure/gateway/GrokGatewayService')
    return getGrokGatewayService().getStatus()
  })

  handle('gateway:ensure', async () => {
    const {
      getGrokGatewayService
    } = await import('../../src/infrastructure/gateway/GrokGatewayService')
    const { SettingsStore } = await import(
      '../../src/infrastructure/settings/SettingsStore'
    )
    const { app } = await import('electron')
    const { join } = await import('path')
    const gw = getGrokGatewayService()
    const store = new SettingsStore(join(app.getPath('userData'), 'settings.json'))
    const current = store.load()
    const { status, apiKey, keyCreated } = await gw.ensureRunningWithApiKey(
      current.apiKey
    )
    // Auto-wire base URL + key; never surface key to UI
    if (apiKey || status.healthOk) {
      store.save({
        ...current,
        llmProvider: current.llmProvider || 'grok-gateway',
        baseUrl: gw.baseUrl,
        ...(apiKey ? { apiKey } : {})
      })
    }
    activity.append({
      kind: 'settings',
      message: `gateway ensure → ${status.state}`,
      meta: {
        healthOk: status.healthOk,
        grok: Boolean(status.grokPath),
        gctoac: Boolean(status.gctoacPath),
        keyCreated,
        keyReady: Boolean(apiKey)
      }
    })
    return {
      ...status,
      keyReady: Boolean(apiKey),
      keyCreated,
      // Never return the plaintext key to the renderer
      baseUrl: gw.baseUrl
    }
  })

  handle('gateway:installHints', async () => {
    const {
      GrokGatewayService
    } = await import('../../src/infrastructure/gateway/GrokGatewayService')
    return {
      grokBuildUrl: GrokGatewayService.grokBuildInstallUrl(),
      gatewayDocsUrl: GrokGatewayService.gatewayDocsUrl(),
      installCommand: GrokGatewayService.grokBuildInstallCommand()
    }
  })

  /** Open gateway Admin UI in an in-app BrowserWindow (reliable when OS browser open fails). */
  let adminWindow: import('electron').BrowserWindow | null = null
  handle('gateway:openAdmin', async (_e, url?: string) => {
    const { BrowserWindow } = await import('electron')
    const {
      getGrokGatewayService
    } = await import('../../src/infrastructure/gateway/GrokGatewayService')
    const gw = getGrokGatewayService()
    // Ensure process is up before opening UI
    const st = await gw.ensureRunning()
    const target =
      (typeof url === 'string' && url.trim()) ||
      st.adminUrl ||
      gw.adminUrl

    if (adminWindow && !adminWindow.isDestroyed()) {
      adminWindow.focus()
      if (adminWindow.webContents.getURL() !== target) {
        await adminWindow.loadURL(target)
      }
      return { ok: true as const, url: target, reused: true as const, state: st.state }
    }

    adminWindow = new BrowserWindow({
      width: 1100,
      height: 800,
      minWidth: 720,
      minHeight: 480,
      title: 'Grok Gateway Admin',
      backgroundColor: '#0f172a',
      autoHideMenuBar: true,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    adminWindow.on('closed', () => {
      adminWindow = null
    })
    // External links from admin → system browser
    adminWindow.webContents.setWindowOpenHandler(({ url: u }) => {
      if (/^https?:\/\//i.test(u)) {
        void shell.openExternal(u).catch(() => undefined)
      }
      return { action: 'deny' }
    })
    await adminWindow.loadURL(target)
    adminWindow.focus()
    return {
      ok: true as const,
      url: target,
      reused: false as const,
      state: st.state,
      healthOk: st.healthOk
    }
  })

  handle(
    'ai:probeVideo',
    (async () => aiClient.videoProvider.probe())
  )

  handle(
    'ai:probeChat',
    (async () => aiClient.probeChat())
  )

  handle(
    'ai:listModels',
    (async () => aiClient.listModels())
  )

  handle(
    'ai:testChat',
    (async (_e, prompt?: string) => aiClient.testChat(prompt))
  )

  handle(
    'ai:applyLlmPreset',
    (async (_e, preset: string) => {
      const {
        applyLlmPreset,
        coerceLlmProviderPreset
      } = await import('../../src/domain/openaiCompatible')
      const current = settingsStore.load()
      const id = coerceLlmProviderPreset(preset, current.baseUrl)
      const patched = applyLlmPreset(current, id)
      const next = settingsStore.save({
        llmProvider: patched.llmProvider,
        baseUrl: patched.baseUrl,
        videoPath: patched.videoPath,
        model: patched.model
      })
      rebindAi(next)
      if (id === 'grok-gateway') {
        void import('../../src/infrastructure/gateway/GrokGatewayService')
          .then(({ getGrokGatewayService }) =>
            getGrokGatewayService().ensureRunning()
          )
          .catch(() => undefined)
      }
      activity.append({
        kind: 'settings',
        message: `llm preset → ${id}`,
        meta: { baseUrl: next.baseUrl }
      })
      return next
    })
  )

  /** @deprecated alias — same as applyLlmPreset('grok-gateway') */
  handle(
    'ai:applyGrokDefaults',
    (async () => {
      const { applyLlmPreset } = await import('../../src/domain/openaiCompatible')
      const current = settingsStore.load()
      const patched = applyLlmPreset(current, 'grok-gateway')
      const next = settingsStore.save({
        llmProvider: patched.llmProvider,
        baseUrl: patched.baseUrl,
        videoPath: patched.videoPath,
        model: patched.model
      })
      rebindAi(next)
      return next
    })
  )

  // ─── Settings ──────────────────────────────────────────────
  handle(
    'settings:get',
    (async () => {
      const s = settingsStore.load()
      if (settingsStore.lastLoadMigrated) {
        activity.append({
          kind: 'settings',
          message: 'migrated gateway defaults 39281 → 3847'
        })
        settingsStore.lastLoadMigrated = false
      }
      return s
    })
  )
  handle(
    'settings:set',
    (async (_e, partial: Partial<AppSettings>) => {
      const next = settingsStore.save(partial)
      rebindAi(next)
      // Auto-start local gateway when user switches to / saves Grok preset
      if (
        next.llmProvider === 'grok-gateway' ||
        next.imageProvider === 'grok-gateway' ||
        next.videoProvider === 'grok-gateway'
      ) {
        void import('../../src/infrastructure/gateway/GrokGatewayService')
          .then(({ getGrokGatewayService }) =>
            getGrokGatewayService().ensureRunning()
          )
          .catch(() => undefined)
      }
      return next
    })
  )

  // ─── Shell helpers ─────────────────────────────────────────
  handle(
    'shell:openExternal',
    (async (_e, url: string) => {
      const raw = typeof url === 'string' ? url.trim() : ''
      if (!raw) {
        throw new AppError('VALIDATION', 'URL is required')
      }
      let parsed: URL
      try {
        parsed = new URL(raw)
      } catch {
        throw new AppError('VALIDATION', `Invalid URL: ${raw}`)
      }
      if (!['http:', 'https:', 'mailto:'].includes(parsed.protocol)) {
        throw new AppError(
          'VALIDATION',
          `Unsupported URL protocol: ${parsed.protocol}`
        )
      }
      const href = parsed.href
      try {
        await shell.openExternal(href)
        return { ok: true as const, url: href }
      } catch (first) {
        // Linux / sandboxed environments: Electron openExternal can fail
        // while xdg-open / open still works.
        const { execFile } = await import('child_process')
        const { promisify } = await import('util')
        const execFileAsync = promisify(execFile)
        try {
          if (process.platform === 'darwin') {
            await execFileAsync('open', [href])
          } else if (process.platform === 'win32') {
            await execFileAsync('cmd', ['/c', 'start', '', href])
          } else {
            await execFileAsync('xdg-open', [href])
          }
          return { ok: true as const, url: href, via: 'fallback' as const }
        } catch {
          throw new AppError(
            'IO',
            `Could not open URL in browser: ${href}`,
            first instanceof Error ? first.message : String(first)
          )
        }
      }
    })
  )

  handle(
    'shell:openPath',
    (async (_e, filePath: string) => {
      const err = await shell.openPath(filePath)
      if (err) throw new AppError('IO', err)
      return { ok: true as const }
    })
  )

  handle(
    'shell:showItemInFolder',
    (async (_e, filePath: string) => {
      shell.showItemInFolder(filePath)
      return { ok: true as const }
    })
  )

  // ─── Media ─────────────────────────────────────────────────
  handle(
    'media:pickRefImage',
    (async () => {
      const win = getMainWindow()
      const options: OpenDialogOptions = {
        title: 'Select reference image',
        filters: [
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
        ],
        properties: ['openFile']
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null

      const src = result.filePaths[0]
      const destDir = join(mediaRoot(), 'refs')
      mkdirSync(destDir, { recursive: true })
      const dest = join(
        destDir,
        `${Date.now()}${extname(src) || '.png'}`
      )
      copyFileSync(src, dest)
      return { filePath: dest, originalName: basename(src) }
    })
  )

  handle(
    'media:exportStoryboard',
    (async (_e, storyId: string) => generation().exportStoryboard(storyId))
  )

  handle(
    'media:exportConcat',
    (async (_e, storyId: string) => generation().exportConcat(storyId))
  )

  handle(
    'media:exportFinal',
    (
      async (
        _e,
        storyId: string,
        options?: Partial<{
          exportProfile: 'balanced' | 'fast'
          burnSubtitles: boolean
          includeSilentAudio: boolean
          bgmVolume: number
          dialogueVolume: number
          openExportFolder: boolean
        }>
      ) => {
        // Remember last one-shot export choices (not a permanent Settings tab)
        if (options && typeof options === 'object') {
          const patch: Record<string, unknown> = {}
          if (options.exportProfile === 'balanced' || options.exportProfile === 'fast') {
            patch.exportProfile = options.exportProfile
          }
          if (typeof options.burnSubtitles === 'boolean') {
            patch.burnSubtitles = options.burnSubtitles
          }
          if (typeof options.includeSilentAudio === 'boolean') {
            patch.includeSilentAudio = options.includeSilentAudio
          }
          if (typeof options.bgmVolume === 'number') {
            patch.bgmVolume = options.bgmVolume
          }
          if (typeof options.dialogueVolume === 'number') {
            patch.dialogueVolume = options.dialogueVolume
          }
          if (typeof options.openExportFolder === 'boolean') {
            patch.openExportFolder = options.openExportFolder
          }
          if (Object.keys(patch).length > 0) {
            const next = settingsStore.save(patch as Partial<AppSettings>)
            rebindAi(next)
          }
        }
        const result = await generation().exportFinal(storyId, options)
        activity.append({
          kind: 'export',
          message: 'final',
          storyId,
          meta: { path: result.outputPath, options: options ?? null }
        })
        return result
      }
    )
  )

  handle(
    'media:listExports',
    (async (_e, storyId: string) => generation().listExports(storyId))
  )

  handle(
    'media:deleteExport',
    (async (_e, storyId: string, exportId: string) => {
      const result = await generation().deleteExport(storyId, exportId)
      activity.append({
        kind: 'export',
        message: 'delete',
        storyId,
        meta: { exportId, ok: result.ok }
      })
      return result
    })
  )

  handle(
    'media:toPreviewUrl',
    (async (_e, filePath: string) => {
      if (!filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', 'Media file not found')
      }
      // Bust Chromium cache when the same path is rewritten (mtime changes).
      let bust = Date.now()
      try {
        bust = statSync(filePath).mtimeMs
      } catch {
        /* keep Date.now() */
      }
      const url = `idm-media://local/?p=${encodeURIComponent(filePath)}&t=${bust}`
      return { url, filePath }
    })
  )

  /** Save a copy of any local media file (Save as…). */
  handle(
    'media:saveAs',
    (async (_e, filePath: string) => {
      if (!filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', 'Media file not found')
      }
      const win = getMainWindow()
      const ext = extname(filePath).replace(/^\./, '') || 'png'
      const filters =
        ['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext.toLowerCase())
          ? [
              {
                name: 'Images',
                extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif']
              },
              { name: 'All files', extensions: ['*'] }
            ]
          : [
              { name: 'Media', extensions: [ext] },
              { name: 'All files', extensions: ['*'] }
            ]
      const options = {
        title: 'Save as',
        defaultPath: basename(filePath),
        filters
      }
      const result = win
        ? await dialog.showSaveDialog(win, options)
        : await dialog.showSaveDialog(options)
      if (result.canceled || !result.filePath) return null
      copyFileSync(filePath, result.filePath)
      activity.append({
        kind: 'media',
        message: 'saveAs',
        meta: { from: filePath, to: result.filePath }
      })
      return { filePath: result.filePath }
    })
  )

  handle(
    'media:checkFfmpeg',
    (async () => {
      const { FfmpegService } = await import(
        '../../src/infrastructure/ffmpeg/FfmpegService'
      )
      try {
        const svc = new FfmpegService()
        await svc.ensureAvailable()
        return {
          available: true,
          message: `ffmpeg OK (${svc.binaryPath})`
        }
      } catch (error) {
        return {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
    })
  )

  handle(
    'media:exportPreflight',
    (async (_e, storyId: string) => generation().exportPreflight(storyId))
  )

  handle(
    'app:getInfo',
    (async () => ({
      version: app.getVersion(),
      name: app.getName(),
      electron: process.versions.electron ?? 'unknown',
      userData: app.getPath('userData'),
      mediaRoot: mediaRoot(),
      isPackaged: app.isPackaged,
      platform: process.platform
    }))
  )

  // ─── Auto-update ───────────────────────────────────────────
  handle(
    'updates:status',
    (async () => appUpdateService.getState())
  )
  handle(
    'updates:check',
    (async () => {
      const state = await appUpdateService.check()
      activity.append({
        kind: 'update',
        message: `check → ${state.status}`,
        meta: { latest: state.latestVersion ?? null }
      })
      return state
    })
  )
  handle(
    'updates:download',
    (async () => {
      const state = await appUpdateService.download()
      activity.append({ kind: 'update', message: `download → ${state.status}` })
      return state
    })
  )
  handle(
    'updates:install',
    (async () => {
      activity.append({ kind: 'update', message: 'quitAndInstall' })
      return appUpdateService.quitAndInstall()
    })
  )

  // ─── Activity + support report ─────────────────────────────
  handle(
    'activity:recent',
    (async (_e, limit?: number) => activity.readRecent(limit ?? 80))
  )
  handle(
    'activity:query',
    (
      async (
        _e,
        opts?: {
          limit?: number
          kind?: string
          level?: string
          q?: string
          since?: string
          until?: string
        }
      ) => {
        const entries = activity.query({
          limit: opts?.limit ?? 300,
          kind: opts?.kind,
          level: (opts?.level as 'debug' | 'info' | 'warn' | 'error' | 'all') ?? 'all',
          q: opts?.q,
          since: opts?.since,
          until: opts?.until
        })
        return {
          entries,
          totalReturned: entries.length,
          path: activity.path,
          kinds: activity.kinds()
        }
      }
    )
  )
  handle(
    'activity:clear',
    (async () => activity.clear())
  )
  handle(
    'activity:getPath',
    (async () => ({ path: activity.path }))
  )
  handle(
    'activity:openLogFolder',
    (async () => {
      const dir = dirname(activity.path)
      mkdirSync(dir, { recursive: true })
      await shell.openPath(dir)
      return { ok: true as const, path: dir }
    })
  )

  handle(
    'support:exportReport',
    (async () => {
      const win = getMainWindow()
      const chat = await aiClient.getStatus()
      const video = await aiClient.videoProvider.probe()
      let ffmpeg = { available: false, message: 'unknown' }
      try {
        const { FfmpegService } = await import(
          '../../src/infrastructure/ffmpeg/FfmpegService'
        )
        await new FfmpegService().ensureAvailable()
        ffmpeg = { available: true, message: 'ffmpeg OK' }
      } catch (error) {
        ffmpeg = {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
      const tips: string[] = []
      if (!chat.available) tips.push('Start Gateway; set baseUrl + API key.')
      if (!video.available) tips.push('Enable videoApi; agent/admin key.')
      if (!ffmpeg.available) {
        tips.push(
          'FFmpeg missing: reinstall the app (bundled binary) or set FFMPEG_PATH.'
        )
      }

      const defaultPath = supportReportPath(app.getPath('userData'))
      const result = win
        ? await dialog.showSaveDialog(win, {
            title: 'Export support report',
            defaultPath,
            filters: [{ name: 'JSON', extensions: ['json'] }]
          })
        : await dialog.showSaveDialog({
            title: 'Export support report',
            defaultPath,
            filters: [{ name: 'JSON', extensions: ['json'] }]
          })
      if (result.canceled || !result.filePath) return null

      const path = writeSupportReportJson(result.filePath, {
        generatedAt: new Date().toISOString(),
        app: {
          version: app.getVersion(),
          name: app.getName(),
          isPackaged: app.isPackaged,
          platform: process.platform,
          electron: process.versions.electron ?? 'unknown',
          userData: app.getPath('userData'),
          mediaRoot: mediaRoot()
        },
        diagnostics: {
          chat,
          video,
          ffmpeg,
          videoMode: settings.videoMode,
          tips
        },
        settings: redactSettings(settingsStore.load()),
        activity: activity.readRecent(120)
      })
      activity.append({ kind: 'support', message: 'export report', meta: { path } })
      return { filePath: path }
    })
  )

  handle(
    'diagnostics:full',
    (async () => {
      const chatProbe = await aiClient.probeChat()
      const chat = await aiClient.getStatus()
      const video = await aiClient.videoProvider.probe()
      let ffmpeg = { available: false, message: 'unknown' }
      try {
        const { FfmpegService } = await import(
          '../../src/infrastructure/ffmpeg/FfmpegService'
        )
        await new FfmpegService().ensureAvailable()
        ffmpeg = { available: true, message: 'ffmpeg OK' }
      } catch (error) {
        ffmpeg = {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
      const tips: string[] = []
      if (!settings.apiKey?.trim()) {
        tips.push(
          'LLM: create API key in Grok Gateway Admin → Keys (gk_live_…), paste in Settings.'
        )
      }
      if (!chat.available) {
        tips.push(
          'Start Grok Gateway: gctoac start (default :3847). https://github.com/yanshekki/Grok-Cli-to-OpenAI-compatible'
        )
      }
      if (!video.available) {
        tips.push('Video: enable videoApi; use agent/admin key; videoPath=/v1/videos.')
      }
      if (!ffmpeg.available) {
        tips.push(
          'FFmpeg missing: reinstall the app (bundled binary) or set FFMPEG_PATH.'
        )
      }
      if (app.isPackaged) {
        tips.push(`Media files live under: ${mediaRoot()}`)
      }
      return {
        chat,
        chatProbe,
        video,
        ffmpeg,
        videoMode: settings.videoMode,
        tips,
        app: {
          version: app.getVersion(),
          name: app.getName(),
          isPackaged: app.isPackaged,
          userData: app.getPath('userData'),
          mediaRoot: mediaRoot()
        }
      }
    })
  )

  handle(
    'media:pickBgm',
    (async () => {
      const win = getMainWindow()
      const options: OpenDialogOptions = {
        title: 'Select BGM',
        filters: [
          { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'] }
        ],
        properties: ['openFile']
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      const src = result.filePaths[0]
      const destDir = join(mediaRoot(), 'bgm')
      mkdirSync(destDir, { recursive: true })
      const dest = join(destDir, `${Date.now()}${extname(src) || '.mp3'}`)
      copyFileSync(src, dest)
      const next = settingsStore.save({ bgmPath: dest })
      rebindAi(next)
      return { filePath: dest }
    })
  )

  // ─── Project backup ────────────────────────────────────────
  const backup = (): ProjectBackupService =>
    new ProjectBackupService(getPrisma(), new MediaStore(mediaRoot()))

  handle(
    'project:exportBackup',
    (async (_e, storyId: string) => {
      const win = getMainWindow()
      const result = win
        ? await dialog.showSaveDialog(win, {
            title: 'Export story backup',
            defaultPath: `story-${storyId}.idm.zip`,
            filters: [{ name: 'IDM Backup', extensions: ['zip'] }]
          })
        : await dialog.showSaveDialog({
            title: 'Export story backup',
            defaultPath: `story-${storyId}.idm.zip`,
            filters: [{ name: 'IDM Backup', extensions: ['zip'] }]
          })
      if (result.canceled || !result.filePath) return null
      const path = await backup().exportStoryToZip(storyId, result.filePath)
      return { filePath: path }
    })
  )

  handle(
    'project:importBackup',
    (async () => {
      const win = getMainWindow()
      const options: OpenDialogOptions = {
        title: 'Import story backup',
        filters: [{ name: 'IDM Backup', extensions: ['zip'] }],
        properties: ['openFile']
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      return backup().importZipAsNewStory(result.filePaths[0])
    })
  )

  handle(
    'media:importClip',
    (async (_e, storyId: string, entryId: string) => {
      const win = getMainWindow()
      const options: OpenDialogOptions = {
        title: 'Import video clip',
        filters: [
          { name: 'Video', extensions: ['mp4', 'webm', 'mov', 'mkv'] }
        ],
        properties: ['openFile']
      }
      const result = win
        ? await dialog.showOpenDialog(win, options)
        : await dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null

      const dest = generation()
        .getMediaStore()
        .importClip(storyId, entryId, result.filePaths[0])
      await timeline().setMedia(entryId, {
        mediaPath: dest,
        mediaStatus: 'READY',
        mediaError: null
      })
      return { filePath: dest }
    })
  )

  handle(
    'media:openClip',
    (async (_e, filePath: string) => {
      if (!existsSync(filePath)) {
        throw new AppError('NOT_FOUND', `Clip not found: ${filePath}`)
      }
      const err = await shell.openPath(filePath)
      if (err) throw new AppError('IO', err)
      return { ok: true as const }
    })
  )
}
