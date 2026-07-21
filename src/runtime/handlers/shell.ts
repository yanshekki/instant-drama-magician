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

export function registerShellHandlers(ctx: HandlerContext): void {
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

// ─── Shell helpers ─────────────────────────────────────────
reg(
  'shell:openExternal',
  (async ( url: string) => {
    const raw = typeof url === 'string' ? url.trim() : ''
    if (!raw) {
      throw new AppError('VALIDATION', 'errors.urlRequired')
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
      await host.shell.openExternal(href)
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

reg(
  'shell:openPath',
  (async ( filePath: string) => {
    const err = await host.shell.openPath(filePath)
    if (err) throw new AppError('IO', err)
    return { ok: true as const }
  })
)

reg(
  'shell:showItemInFolder',
  (async ( filePath: string) => {
    host.shell.showItemInFolder(filePath)
    return { ok: true as const }
  })
)

}
