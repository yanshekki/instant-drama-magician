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
import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { basename, extname, join } from 'path'
import { GrokCliClient } from '../../src/infrastructure/ai/GrokCliClient'
import { SettingsStore } from '../../src/infrastructure/settings/SettingsStore'
import {
  CharacterService,
  DemoSeedService,
  GenerationService,
  ProjectBackupService,
  PropService,
  SceneService,
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
  UpdateTimelineEntryInput
} from '../../src/types/domain'
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

function wrap<TArgs extends unknown[], TResult>(
  fn: (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult>
): (event: IpcMainInvokeEvent, ...args: TArgs) => Promise<TResult> {
  return async (event, ...args) => {
    try {
      return await fn(event, ...args)
    } catch (error) {
      const body = toAppError(error)
      throw new Error(JSON.stringify(body))
    }
  }
}

export function registerIpcHandlers(ctx: IpcContext): void {
  const { ipcMain, dialog, shell, getPrisma, getMainWindow } = ctx
  const settingsStore = new SettingsStore(
    SettingsStore.defaultPath(app.getPath('userData'))
  )
  let settings = settingsStore.load()
  let aiClient = new GrokCliClient(settings)
  const mediaRoot = (): string => join(app.getPath('userData'), 'media')
  const activity = new ActivityLog(ActivityLog.defaultPath(app.getPath('userData')))

  const stories = (): StoryService => new StoryService(getPrisma())
  const characters = (): CharacterService => new CharacterService(getPrisma())
  const scenes = (): SceneService => new SceneService(getPrisma())
  const props = (): PropService => new PropService(getPrisma())
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
  ipcMain.handle(
    'stories:list',
    wrap(async () => stories().list())
  )
  ipcMain.handle(
    'stories:get',
    wrap(async (_e, id: string) => stories().get(id))
  )
  ipcMain.handle(
    'stories:create',
    wrap(async (_e, input: CreateStoryInput) => stories().create(input))
  )
  ipcMain.handle(
    'stories:update',
    wrap(
      async (
        _e,
        id: string,
        data: { title?: string; status?: string; styleNote?: string | null }
      ) => stories().update(id, data)
    )
  )
  ipcMain.handle(
    'stories:delete',
    wrap(async (_e, id: string) => stories().delete(id))
  )
  ipcMain.handle(
    'stories:seedDemo',
    wrap(async (_e, locale?: 'zh-HK' | 'en') => {
      const result = await new DemoSeedService(getPrisma()).seed(locale ?? 'zh-HK')
      settingsStore.save({ firstRunSeen: true })
      return result
    })
  )

  // ─── Characters ────────────────────────────────────────────
  ipcMain.handle(
    'characters:list',
    wrap(async (_e, storyId: string) => characters().list(storyId))
  )
  ipcMain.handle(
    'characters:create',
    wrap(async (_e, input: CreateCharacterInput) => characters().create(input))
  )
  ipcMain.handle(
    'characters:update',
    wrap(
      async (
        _e,
        id: string,
        data: Partial<
          Pick<CreateCharacterInput, 'name' | 'description' | 'soulMdPath' | 'refImagePath'>
        >
      ) => characters().update(id, data)
    )
  )
  ipcMain.handle(
    'characters:delete',
    wrap(async (_e, id: string) => characters().delete(id))
  )
  ipcMain.handle(
    'characters:importSoulMd',
    wrap(async () => {
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

  ipcMain.handle(
    'characters:importSoulMdUrl',
    wrap(async (_e, url: string) => {
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
  ipcMain.handle(
    'scenes:list',
    wrap(async (_e, storyId: string) => scenes().list(storyId))
  )
  ipcMain.handle(
    'scenes:create',
    wrap(async (_e, input: CreateSceneInput) => scenes().create(input))
  )
  ipcMain.handle(
    'scenes:update',
    wrap(
      async (
        _e,
        id: string,
        data: Partial<
          Pick<CreateSceneInput, 'sceneNumber' | 'description' | 'script' | 'status'>
        >
      ) => scenes().update(id, data)
    )
  )
  ipcMain.handle(
    'scenes:delete',
    wrap(async (_e, id: string) => scenes().delete(id))
  )

  // ─── Props ─────────────────────────────────────────────────
  ipcMain.handle(
    'props:list',
    wrap(async (_e, storyId: string) => props().list(storyId))
  )
  ipcMain.handle(
    'props:create',
    wrap(async (_e, input: CreatePropInput) => props().create(input))
  )
  ipcMain.handle(
    'props:update',
    wrap(
      async (
        _e,
        id: string,
        data: Partial<Pick<CreatePropInput, 'name' | 'description'>>
      ) => props().update(id, data)
    )
  )
  ipcMain.handle(
    'props:delete',
    wrap(async (_e, id: string) => props().delete(id))
  )

  // ─── Timeline ──────────────────────────────────────────────
  ipcMain.handle(
    'timeline:list',
    wrap(async (_e, storyId: string) => timeline().list(storyId))
  )
  ipcMain.handle(
    'timeline:create',
    wrap(async (_e, input: CreateTimelineEntryInput) => timeline().create(input))
  )
  ipcMain.handle(
    'timeline:update',
    wrap(async (_e, id: string, data: UpdateTimelineEntryInput) =>
      timeline().update(id, data)
    )
  )
  ipcMain.handle(
    'timeline:delete',
    wrap(async (_e, id: string) => timeline().delete(id))
  )
  ipcMain.handle(
    'timeline:reorder',
    wrap(async (_e, storyId: string, orderedIds: string[]) =>
      timeline().reorder(storyId, orderedIds)
    )
  )

  ipcMain.handle(
    'timeline:setMedia',
    wrap(
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
  ipcMain.handle(
    'generation:run',
    wrap(
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

  ipcMain.handle(
    'generation:cancel',
    wrap(async () => {
      generation().cancel()
      activity.append({ kind: 'generation', message: 'cancelled' })
      return { ok: true as const }
    })
  )

  ipcMain.handle(
    'generation:runClip',
    wrap(async (event, storyId: string, entryId: string) => {
      activity.append({
        kind: 'generation',
        message: 'run clip',
        storyId,
        meta: { entryId }
      })
      const result = await generation().generateClip(storyId, entryId, (payload) => {
        event.sender.send('generation:progress', payload)
      })
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

  ipcMain.handle(
    'ai:status',
    wrap(async () => aiClient.getStatus())
  )

  ipcMain.handle(
    'ai:probeVideo',
    wrap(async () => aiClient.videoProvider.probe())
  )

  ipcMain.handle(
    'ai:probeChat',
    wrap(async () => aiClient.probeChat())
  )

  ipcMain.handle(
    'ai:listModels',
    wrap(async () => aiClient.listModels())
  )

  ipcMain.handle(
    'ai:testChat',
    wrap(async (_e, prompt?: string) => aiClient.testChat(prompt))
  )

  ipcMain.handle(
    'ai:applyGrokDefaults',
    wrap(async () => {
      const { GROK_GATEWAY_BASE_URL, GROK_GATEWAY_VIDEO_PATH } = await import(
        '../../src/domain/gatewayDefaults'
      )
      const next = settingsStore.save({
        baseUrl: GROK_GATEWAY_BASE_URL,
        videoPath: GROK_GATEWAY_VIDEO_PATH
      })
      rebindAi(next)
      return next
    })
  )

  // ─── Settings ──────────────────────────────────────────────
  ipcMain.handle(
    'settings:get',
    wrap(async () => {
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
  ipcMain.handle(
    'settings:set',
    wrap(async (_e, partial: Partial<AppSettings>) => {
      const next = settingsStore.save(partial)
      rebindAi(next)
      return next
    })
  )

  // ─── Shell helpers ─────────────────────────────────────────
  ipcMain.handle(
    'shell:openExternal',
    wrap(async (_e, url: string) => {
      await shell.openExternal(url)
      return { ok: true as const }
    })
  )

  ipcMain.handle(
    'shell:openPath',
    wrap(async (_e, filePath: string) => {
      const err = await shell.openPath(filePath)
      if (err) throw new AppError('IO', err)
      return { ok: true as const }
    })
  )

  ipcMain.handle(
    'shell:showItemInFolder',
    wrap(async (_e, filePath: string) => {
      shell.showItemInFolder(filePath)
      return { ok: true as const }
    })
  )

  // ─── Media ─────────────────────────────────────────────────
  ipcMain.handle(
    'media:pickRefImage',
    wrap(async () => {
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

  ipcMain.handle(
    'media:exportStoryboard',
    wrap(async (_e, storyId: string) => generation().exportStoryboard(storyId))
  )

  ipcMain.handle(
    'media:exportConcat',
    wrap(async (_e, storyId: string) => generation().exportConcat(storyId))
  )

  ipcMain.handle(
    'media:exportFinal',
    wrap(async (_e, storyId: string) => {
      const result = await generation().exportFinal(storyId)
      activity.append({
        kind: 'export',
        message: 'final',
        storyId,
        meta: { path: result.outputPath }
      })
      return result
    })
  )

  ipcMain.handle(
    'media:toPreviewUrl',
    wrap(async (_e, filePath: string) => {
      if (!filePath || !existsSync(filePath)) {
        throw new AppError('NOT_FOUND', 'Media file not found')
      }
      const url = `idm-media://local/?p=${encodeURIComponent(filePath)}`
      return { url, filePath }
    })
  )

  ipcMain.handle(
    'media:checkFfmpeg',
    wrap(async () => {
      const { FfmpegService } = await import(
        '../../src/infrastructure/ffmpeg/FfmpegService'
      )
      try {
        await new FfmpegService().ensureAvailable()
        return { available: true, message: 'ffmpeg OK' }
      } catch (error) {
        return {
          available: false,
          message: error instanceof Error ? error.message : String(error)
        }
      }
    })
  )

  ipcMain.handle(
    'media:exportPreflight',
    wrap(async (_e, storyId: string) => generation().exportPreflight(storyId))
  )

  ipcMain.handle(
    'app:getInfo',
    wrap(async () => ({
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
  ipcMain.handle(
    'updates:status',
    wrap(async () => appUpdateService.getState())
  )
  ipcMain.handle(
    'updates:check',
    wrap(async () => {
      const state = await appUpdateService.check()
      activity.append({
        kind: 'update',
        message: `check → ${state.status}`,
        meta: { latest: state.latestVersion ?? null }
      })
      return state
    })
  )
  ipcMain.handle(
    'updates:download',
    wrap(async () => {
      const state = await appUpdateService.download()
      activity.append({ kind: 'update', message: `download → ${state.status}` })
      return state
    })
  )
  ipcMain.handle(
    'updates:install',
    wrap(async () => {
      activity.append({ kind: 'update', message: 'quitAndInstall' })
      return appUpdateService.quitAndInstall()
    })
  )

  // ─── Activity + support report ─────────────────────────────
  ipcMain.handle(
    'activity:recent',
    wrap(async (_e, limit?: number) => activity.readRecent(limit ?? 80))
  )

  ipcMain.handle(
    'support:exportReport',
    wrap(async () => {
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
      if (!ffmpeg.available) tips.push('Install ffmpeg or set FFMPEG_PATH.')

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

  ipcMain.handle(
    'diagnostics:full',
    wrap(async () => {
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
          app.isPackaged
            ? 'Packaged build: install system ffmpeg (or set FFMPEG_PATH).'
            : 'Install ffmpeg or set FFMPEG_PATH.'
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

  ipcMain.handle(
    'media:pickBgm',
    wrap(async () => {
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

  ipcMain.handle(
    'project:exportBackup',
    wrap(async (_e, storyId: string) => {
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

  ipcMain.handle(
    'project:importBackup',
    wrap(async () => {
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

  ipcMain.handle(
    'media:importClip',
    wrap(async (_e, storyId: string, entryId: string) => {
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

  ipcMain.handle(
    'media:openClip',
    wrap(async (_e, filePath: string) => {
      if (!existsSync(filePath)) {
        throw new AppError('NOT_FOUND', `Clip not found: ${filePath}`)
      }
      const err = await shell.openPath(filePath)
      if (err) throw new AppError('IO', err)
      return { ok: true as const }
    })
  )
}
