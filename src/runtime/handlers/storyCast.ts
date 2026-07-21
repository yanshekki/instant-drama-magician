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

export function registerStorycastHandlers(ctx: HandlerContext): void {
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

// ─── Story cast (M2M link/unlink) ──────────────────────────
const cast = (): StoryCastService => new StoryCastService(host.getPrisma())
reg(
  'stories:linkCharacter',
  (
    async (
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
reg(
  'stories:setCharacterCostume',
  (
    async (
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
reg(
  'stories:unlinkCharacter',
  (
    async ( payload: { storyId: string; characterId: string }) =>
      cast().unlinkCharacter(payload.storyId, payload.characterId)
  )
)
reg(
  'stories:linkScene',
  (
    async (
      payload: { storyId: string; sceneId: string; sceneNumber?: number }
    ) =>
      cast().linkScene(payload.storyId, payload.sceneId, {
        sceneNumber: payload.sceneNumber
      })
  )
)
reg(
  'stories:unlinkScene',
  (
    async ( payload: { storyId: string; sceneId: string }) =>
      cast().unlinkScene(payload.storyId, payload.sceneId)
  )
)
reg(
  'stories:linkProp',
  (
    async ( payload: { storyId: string; propId: string }) =>
      cast().linkProp(payload.storyId, payload.propId)
  )
)
reg(
  'stories:unlinkProp',
  (
    async ( payload: { storyId: string; propId: string }) =>
      cast().unlinkProp(payload.storyId, payload.propId)
  )
)
reg(
  'stories:linkAction',
  (
    async (payload: { storyId: string; actionId: string }) =>
      cast().linkAction(payload.storyId, payload.actionId)
  )
)
reg(
  'stories:unlinkAction',
  (
    async (payload: { storyId: string; actionId: string }) =>
      cast().unlinkAction(payload.storyId, payload.actionId)
  )
)
reg(
  'stories:listCast',
  (async ( storyId: string) => {
    const c = cast()
    return {
      characters: await c.listCharactersForStory(storyId),
      scenes: await c.listScenesForStory(storyId),
      props: await c.listPropsForStory(storyId),
      actions: await c.listActionsForStory(storyId)
    }
  })
)

}
