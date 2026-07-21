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

export function registerSettingsHandlers(ctx: HandlerContext): void {
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

// ─── Settings ──────────────────────────────────────────────
reg(
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
reg(
  'settings:set',
  (async ( partial: Partial<AppSettings>) => {
    const prev = settingsStore.load()
    const prevLang = prev.uiLanguage
    const next = settingsStore.save(partial)
    rebindAi(next)
    // Auto-start local gateway when user switches to / saves Grok preset
    if (
      next.llmProvider === 'grok-gateway' ||
      next.imageProvider === 'grok-gateway' ||
      next.videoProvider === 'grok-gateway'
    ) {
      void import('../infrastructure/gateway/GrokGatewayService')
        .then(({ getGrokGatewayService }) =>
          getGrokGatewayService().ensureRunning()
        )
        .catch(() => undefined)
    }
    if (
      partial.uiLanguage !== undefined &&
      partial.uiLanguage !== prevLang &&
      host.rebuildApplicationMenu
    ) {
      try {
        host.rebuildApplicationMenu()
      } catch {
        /* non-fatal */
      }
    }
    // Sync embedded web server when related ctx.settings change
    const webTouched =
      partial.webServerEnabled !== undefined ||
      partial.webServerPort !== undefined ||
      partial.webServerHost !== undefined ||
      partial.webServerAuthToken !== undefined
    if (webTouched) {
      void syncEmbeddedWebServer(next).catch(() => undefined)
    }
    return next
  })
)

}
