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

export function registerActivityHandlers(ctx: HandlerContext): void {
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

// ─── Activity + support report ─────────────────────────────
reg(
  'activity:recent',
  (async ( limit?: number) => activity.readRecent(limit ?? 80))
)
reg(
  'activity:query',
  (
    async (
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
reg(
  'activity:clear',
  (async () => activity.clear())
)
reg(
  'activity:getPath',
  (async () => ({ path: activity.path }))
)
reg(
  'activity:openLogFolder',
  (async () => {
    const dir = dirname(activity.path)
    mkdirSync(dir, { recursive: true })
    await host.shell.openPath(dir)
    return { ok: true as const, path: dir }
  })
)

reg(
  'support:exportReport',
  (async (destPath?: string) => {
    const win = host.getMainWindow()
    const chat = await ctx.aiClient.getStatus()
    const video = await ctx.aiClient.videoProvider.probe()
    let ffmpeg = { available: false, message: 'unknown' }
    try {
      const { FfmpegService } = await import(
        '../infrastructure/ffmpeg/FfmpegService'
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

    const defaultPath = supportReportPath(host.userData)
    let outPath =
      typeof destPath === 'string' && destPath.trim()
        ? destPath.trim()
        : process.env.IDM_SAVE_PATH || ''
    if (!outPath) {
      const result = win
        ? await host.dialog.showSaveDialog(win, {
            title: 'Export support report',
            defaultPath,
            filters: [{ name: 'JSON', extensions: ['json'] }]
          })
        : await host.dialog.showSaveDialog({
            title: 'Export support report',
            defaultPath,
            filters: [{ name: 'JSON', extensions: ['json'] }]
          })
      if (result.canceled || !result.filePath) {
        // Headless fallback: write default path
        if (host.mode === 'headless') outPath = defaultPath
        else return null
      } else {
        outPath = result.filePath
      }
    }

    const path = writeSupportReportJson(outPath, {
      generatedAt: new Date().toISOString(),
      app: {
        version: host.appVersion,
        name: 'InstantDrama Magician',
        isPackaged: host.isPackaged,
        platform: process.platform,
        electron: process.versions.electron ?? 'unknown',
        userData: host.userData,
        mediaRoot: mediaRoot()
      },
      diagnostics: {
        chat,
        video,
        ffmpeg,
        videoMode: ctx.settings.videoMode,
        tips
      },
      settings: redactSettings(settingsStore.load()),
      activity: activity.readRecent(120)
    })
    activity.append({ kind: 'support', message: 'export report', meta: { path } })
    return { filePath: path }
  })
)

reg(
  'diagnostics:full',
  (async () => {
    const chatProbe = await ctx.aiClient.probeChat()
    const chat = await ctx.aiClient.getStatus()
    const video = await ctx.aiClient.videoProvider.probe()
    let ffmpeg = { available: false, message: 'unknown' }
    try {
      const { FfmpegService } = await import(
        '../infrastructure/ffmpeg/FfmpegService'
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
    if (!ctx.settings.apiKey?.trim()) {
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
    if (host.isPackaged) {
      tips.push(`Media files live under: ${mediaRoot()}`)
    }
    return {
      chat,
      chatProbe,
      video,
      ffmpeg,
      videoMode: ctx.settings.videoMode,
      tips,
      app: {
        version: host.appVersion,
        name: 'InstantDrama Magician',
        isPackaged: host.isPackaged,
        userData: host.userData,
        mediaRoot: mediaRoot()
      }
    }
  })
)

reg(
  'media:pickBgm',
  (async (filePath?: string) => {
    let src =
      typeof filePath === 'string' && filePath.trim() ? filePath.trim() : ''
    if (!src) {
      const win = host.getMainWindow()
      const options: OpenDialogOptionsLike = {
        title: 'Select BGM',
        filters: [
          { name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'] }
        ],
        properties: ['openFile']
      }
      const result = win
        ? await host.dialog.showOpenDialog(win, options)
        : await host.dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) return null
      src = result.filePaths[0]
    }
    if (!existsSync(src)) {
      throw new AppError('NOT_FOUND', `Audio not found: ${src}`)
    }
    const destDir = join(mediaRoot(), 'bgm')
    mkdirSync(destDir, { recursive: true })
    const dest = join(destDir, `${Date.now()}${extname(src) || '.mp3'}`)
    copyFileSync(src, dest)
    const next = settingsStore.save({ bgmPath: dest })
    rebindAi(next)
    return { filePath: dest }
  })
)

}
