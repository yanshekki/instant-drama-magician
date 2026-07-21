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

export function registerWebserverHandlers(ctx: HandlerContext): void {
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

// ─── Embedded web server (browser control) ─────────────────
async function resolveWebStaticDir(): Promise<string> {
  // Packaged: out/renderer next to main; dev: project out/renderer
  const candidates = [
    join(__dirname, '../renderer'),
    join(process.cwd(), 'out', 'renderer')
  ]
  for (const c of candidates) {
    if (existsSync(join(c, 'index.html'))) return c
  }
  return candidates[0]
}

async function syncEmbeddedWebServer(
  s: AppSettings
): Promise<import('../../infrastructure/webserver/EmbeddedWebServer').WebServerStatus> {
  const {
    getEmbeddedWebServer,
    generateWebServerToken
  } = await import(
    '../../infrastructure/webserver/EmbeddedWebServer'
  )
  const ws = getEmbeddedWebServer()
  if (!s.webServerEnabled) {
    return ws.stop()
  }
  let token = s.webServerAuthToken?.trim() || ''
  if (!token) {
    token = generateWebServerToken()
    settingsStore.save({ webServerAuthToken: token })
    s = settingsStore.load()
  }
  const staticDir = await resolveWebStaticDir()
  return ws.start({
    dataDir: host.userData,
    port: s.webServerPort || 8787,
    host: s.webServerHost || '0.0.0.0',
    authToken: token,
    authDisabled: false,
    staticDir,
    appVersion: host.appVersion,
    isPackaged: host.isPackaged
  })
}

reg(
  'webServer:status',
  (async () => {
    const { getEmbeddedWebServer } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    return getEmbeddedWebServer().getStatus()
  })
)
reg(
  'webServer:start',
  (async () => {
    const next = settingsStore.save({ webServerEnabled: true })
    try {
      return await syncEmbeddedWebServer(next)
    } catch (e) {
      settingsStore.save({ webServerEnabled: false })
      throw e instanceof AppError
        ? e
        : new AppError(
            'IO',
            e instanceof Error ? e.message : String(e)
          )
    }
  })
)
reg(
  'webServer:stop',
  (async () => {
    settingsStore.save({ webServerEnabled: false })
    const { getEmbeddedWebServer } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    return getEmbeddedWebServer().stop()
  })
)
reg(
  'webServer:generateToken',
  (async () => {
    const { generateWebServerToken } = await import(
      '../../infrastructure/webserver/EmbeddedWebServer'
    )
    const token = generateWebServerToken()
    const next = settingsStore.save({ webServerAuthToken: token })
    if (next.webServerEnabled) {
      await syncEmbeddedWebServer(next)
    }
    return { token, settings: next }
  })
)

}
