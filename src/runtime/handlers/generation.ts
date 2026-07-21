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

export function registerGenerationHandlers(ctx: HandlerContext): void {
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

// ─── Generation ────────────────────────────────────────────
reg(
  'generation:run',
  (
    async (
      storyId: string,
      opts?: { onlyFailedVideos?: boolean; interactiveVideo?: boolean }
    ) => {
      activity.append({
        kind: 'generation',
        message: opts?.onlyFailedVideos
          ? 'retry failed'
          : opts?.interactiveVideo
            ? 'run pipeline (interactive video)'
            : 'run pipeline',
        storyId
      })
      const result = await generation().run(
        storyId,
        (payload) => {
          host.emitGenerationProgress?.(payload)
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

reg(
  'generation:cancel',
  (async () => {
    generation().cancel()
    activity.append({ kind: 'generation', message: 'cancelled' })
    return { ok: true as const }
  })
)

/** Last progress snapshot (push events on electron via host.emitGenerationProgress). */
reg(
  'generation:progress',
  (async () => host.getLastGenerationProgress?.() ?? null)
)

reg(
  'generation:runClip',
  (async (
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
        host.emitGenerationProgress?.(payload)
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

reg(
  'ai:status',
  (async () => ctx.aiClient.getStatus())
)

}
