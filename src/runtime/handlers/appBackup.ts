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

export function registerAppBackupHandlers(ctx: HandlerContext): void {
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

// ─── Full app-data backup (menu / Settings / CLI headless) ─
const fullBackupService = (): AppDataBackupService => {
  const dbUrl = process.env.DATABASE_URL || ''
  let dbPath = join(host.userData, 'instant-drama.db')
  if (dbUrl.startsWith('file:')) {
    let rest = dbUrl.slice('file:'.length)
    if (rest.startsWith('///')) rest = rest.slice(2)
    else if (rest.startsWith('//')) {
      rest = rest.replace(/^\/\/[^/]*/, '') || rest
    }
    dbPath = rest.startsWith('/') ? rest : join(process.cwd(), rest)
  }
  if (host.resolveDatabasePath) {
    try {
      dbPath = host.resolveDatabasePath()
    } catch {
      /* keep */
    }
  }
  return new AppDataBackupService({
    userData: host.userData,
    databasePath: dbPath,
    settingsPath: join(host.userData, 'settings.json'),
    mediaRoot: mediaRoot(),
    activityLogPath: ActivityLog.defaultPath(host.userData),
    appVersion: host.appVersion,
    platform: host.platform
  })
}

reg(
  'app:exportFullBackup',
  (async (options?: {
    destPath?: string
    includeSecrets?: boolean
  }) => {
    if (host.exportFullBackup && !options?.destPath) {
      await host.exportFullBackup()
      return { ok: true as const }
    }
    // Headless / CLI: write zip under dataDir/exports or destPath
    const exportsDir = join(host.userData, 'exports')
    mkdirSync(exportsDir, { recursive: true })
    const dest =
      (typeof options?.destPath === 'string' && options.destPath.trim()) ||
      process.env.IDM_SAVE_PATH ||
      join(exportsDir, defaultFullBackupFileName())
    const prisma = host.getPrisma()
    try {
      await prisma.$disconnect()
    } catch {
      /* ignore */
    }
    try {
      await fullBackupService().exportToZip(dest, {
        includeSecrets: Boolean(options?.includeSecrets),
        includeLogs: true
      })
      return {
        ok: true as const,
        filePath: dest,
        fileName: basename(dest)
      }
    } finally {
      try {
        await prisma.$connect()
      } catch {
        /* ignore */
      }
    }
  })
)
reg(
  'app:importFullBackup',
  (async (zipPath?: string) => {
    if (host.importFullBackup && !zipPath) {
      await host.importFullBackup()
      return { ok: true as const }
    }
    let src =
      typeof zipPath === 'string' && zipPath.trim()
        ? zipPath.trim()
        : process.env.IDM_PICK_FILE || ''
    if (!src) {
      const win = host.getMainWindow()
      const options: OpenDialogOptionsLike = {
        title: 'Restore full app backup',
        filters: [{ name: 'IDM Backup', extensions: ['zip'] }],
        properties: ['openFile']
      }
      const result = win
        ? await host.dialog.showOpenDialog(win, options)
        : await host.dialog.showOpenDialog(options)
      if (result.canceled || result.filePaths.length === 0) {
        throw new AppError('VALIDATION', 'errors.importZipPathRequired')
      }
      src = result.filePaths[0]
    }
    if (!existsSync(src)) {
      throw new AppError('NOT_FOUND', `Backup zip not found: ${src}`)
    }
    const prisma = host.getPrisma()
    try {
      await prisma.$disconnect()
    } catch {
      /* ignore */
    }
    try {
      const result = await fullBackupService().importFromZip(src)
      return { ok: true as const, requiresReload: true, ...result }
    } finally {
      try {
        await prisma.$connect()
      } catch {
        /* ignore */
      }
    }
  })
)
reg(
  'app:rebuildMenu',
  (async () => {
    host.rebuildApplicationMenu?.()
    return { ok: true as const }
  })
)

reg(
  'media:importClip',
  (async (storyId: string, entryId: string, filePath?: string) => {
    let src =
      typeof filePath === 'string' && filePath.trim() ? filePath.trim() : ''
    if (!src) {
      const win = host.getMainWindow()
      const options: OpenDialogOptionsLike = {
        title: 'Import video clip',
        filters: [
          { name: 'Video', extensions: ['mp4', 'webm', 'mov', 'mkv'] }
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
      throw new AppError('NOT_FOUND', `Video not found: ${src}`)
    }

    const dest = generation()
      .getMediaStore()
      .importClip(storyId, entryId, src)
    await timeline().setMedia(entryId, {
      mediaPath: dest,
      mediaStatus: 'READY',
      mediaError: null
    })
    return { filePath: dest }
  })
)

reg(
  'media:openClip',
  (async ( filePath: string) => {
    if (!existsSync(filePath)) {
      throw new AppError('NOT_FOUND', `Clip not found: ${filePath}`)
    }
    const err = await host.shell.openPath(filePath)
    if (err) throw new AppError('IO', err)
    return { ok: true as const }
  })
)

}
