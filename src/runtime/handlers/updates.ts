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

export function registerUpdatesHandlers(ctx: HandlerContext): void {
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

// ─── Auto-update (electron-updater; headless/web returns channel-aware state) ─
async function loadUpdateService() {
  try {
    const mod = await import('../../infrastructure/update/AppUpdateService')
    return mod.appUpdateService
  } catch {
    return null
  }
}

function nonDesktopUpdateState(status: 'dev-skipped' | 'web-skipped') {
  const channel = detectInstallChannel({
    isElectron: Boolean(process.versions.electron),
    isPackaged: host.isPackaged,
    isWeb: !process.versions.electron
  })
  const isWeb = channel === 'web' || status === 'web-skipped'
  return {
    channel: isWeb
      ? ('web' as const)
      : channel === 'desktop-packaged'
        ? ('desktop-dev' as const)
        : channel,
    status: isWeb ? ('web-skipped' as const) : ('dev-skipped' as const),
    currentVersion: host.appVersion,
    messageKey: isWeb ? 'updateWebOnly' : 'updateDevSkipped',
    message: isWeb
      ? 'Use the desktop app or CLI to update'
      : 'Updates only run in packaged builds.',
    releaseUrl: githubReleaseUrl(),
    installCommand: NPM_INSTALL_CMD,
    canAutoInstall: false,
    canDownload: false,
    canCheck: false,
    source: 'none' as const
  }
}

reg(
  'updates:status',
  (async () => {
    const svc = await loadUpdateService()
    if (!svc) {
      return nonDesktopUpdateState(
        process.versions.electron ? 'dev-skipped' : 'web-skipped'
      )
    }
    return svc.getState()
  })
)
reg(
  'updates:check',
  (async (opts?: { silent?: boolean }) => {
    const svc = await loadUpdateService()
    if (!svc) {
      return nonDesktopUpdateState(
        process.versions.electron ? 'dev-skipped' : 'web-skipped'
      )
    }
    const state = await svc.check({ silent: Boolean(opts?.silent) })
    activity.append({
      kind: 'update',
      message: `check → ${state.status}`,
      meta: {
        latest: state.latestVersion ?? null,
        silent: Boolean(opts?.silent)
      }
    })
    return state
  })
)
reg(
  'updates:download',
  (async () => {
    const svc = await loadUpdateService()
    if (!svc) {
      return nonDesktopUpdateState(
        process.versions.electron ? 'dev-skipped' : 'web-skipped'
      )
    }
    const state = await svc.download()
    activity.append({ kind: 'update', message: `download → ${state.status}` })
    return state
  })
)
reg(
  'updates:install',
  (async () => {
    const svc = await loadUpdateService()
    if (!svc) {
      return {
        ok: false,
        message: 'Auto-update requires Electron packaged build',
        messageKey: 'updateDevSkipped'
      }
    }
    activity.append({ kind: 'update', message: 'quitAndInstall' })
    return svc.quitAndInstall()
  })
)
reg(
  'updates:checkNpm',
  (async () => {
    const result = await checkNpmPackageUpdate(
      NPM_PACKAGE_NAME,
      host.appVersion
    )
    activity.append({
      kind: 'update',
      message: `npm check → ${result.updateAvailable ? 'available' : result.error ? 'error' : 'ok'}`,
      meta: { latest: result.latestVersion, error: result.error ?? null }
    })
    return {
      ...result,
      channel: 'cli-npm' as const,
      installCommand: result.installCommand || NPM_INSTALL_CMD
    }
  })
)
reg(
  'updates:openReleasePage',
  (async (version?: string) => {
    const href = githubReleaseUrl(version || undefined)
    try {
      await host.shell.openExternal(href)
      return { ok: true as const, url: href }
    } catch (e) {
      return {
        ok: false as const,
        url: href,
        message: e instanceof Error ? e.message : String(e)
      }
    }
  })
)

}
