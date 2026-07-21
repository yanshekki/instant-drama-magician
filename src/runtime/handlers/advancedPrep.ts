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

export function registerAdvancedprepHandlers(ctx: HandlerContext): void {
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

// ─── Advanced prep (cast looks + storyboard stills) ────────
reg(
  'timeline:getAdvancedPrep',
  (async ( storyId: string) => {
    const { AdvancedPrepService } = await import(
      '../../application/services/AdvancedPrepService'
    )
    const svc = new AdvancedPrepService(
      host.getPrisma(),
      generation().getMediaStore(),
      () => ctx.aiClient as never,
      () => ctx.settings
    )
    return svc.getSnapshot(storyId)
  })
)
reg(
  'timeline:setCastPrep',
  (
    async (
      storyId: string,
      prep: { version?: number; characters?: Record<string, unknown> }
    ) => {
      const {
        parseStoryCastPrep,
        serializeStoryCastPrep
      } = await import('../../domain/advancedPrep')
      const store = generation().getMediaStore()
      const normalized = parseStoryCastPrep(JSON.stringify(prep ?? {}))
      store.writeStoryCastPrepJson(
        storyId,
        serializeStoryCastPrep(normalized)
      )
      return normalized
    }
  )
)
reg(
  'timeline:clearEntryStill',
  (async ( storyId: string, entryId: string) => {
    const { AdvancedPrepService } = await import(
      '../../application/services/AdvancedPrepService'
    )
    const svc = new AdvancedPrepService(
      host.getPrisma(),
      generation().getMediaStore(),
      () => ctx.aiClient as never,
      () => ctx.settings
    )
    return svc.clearEntryStill(storyId, entryId)
  })
)
reg(
  'videoPrep:openFromStill',
  (
    async (
      payload: {
        storyId: string
        entryId: string
        locale?: 'zh-HK' | 'en'
        forcePolish?: boolean
      }
    ) => {
      const { AdvancedPrepService } = await import(
        '../../application/services/AdvancedPrepService'
      )
      const svc = new AdvancedPrepService(
        host.getPrisma(),
        generation().getMediaStore(),
        () => ctx.aiClient as never,
        () => ctx.settings
      )
      return svc.openFromStill({
        storyId: payload.storyId,
        entryId: payload.entryId,
        locale: payload.locale,
        forcePolish: payload.forcePolish
      })
    }
  )
)

}
