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

export function registerGatewayHandlers(ctx: HandlerContext): void {
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

// ─── Local Grok Gateway (gctoac) lifecycle ─────────────────
reg('gateway:status', async () => {
  const {
    getGrokGatewayService
  } = await import('../infrastructure/gateway/GrokGatewayService')
  return getGrokGatewayService().getStatus()
})

reg('gateway:ensure', async () => {
  const {
    getGrokGatewayService
  } = await import('../infrastructure/gateway/GrokGatewayService')
  const gw = getGrokGatewayService()
  // Must use host settingsStore (cached) — a separate SettingsStore would
  // write disk while leaving in-memory ctx.settings + ctx.aiClient on a stale empty key.
  const current = settingsStore.load()
  const { status, apiKey, keyCreated } = await gw.ensureRunningWithApiKey(
    current.apiKey
  )
  // Auto-wire base URL + key into the live store and rebind AI client
  const keyReady = Boolean(apiKey?.trim())
  if (keyReady || status.healthOk) {
    const next = settingsStore.save({
      llmProvider: current.llmProvider || 'grok-gateway',
      baseUrl: gw.baseUrl,
      ...(keyReady ? { apiKey: apiKey!.trim() } : {})
    })
    rebindAi(next)
  }
  activity.append({
    kind: 'settings',
    message: `gateway ensure → ${status.state}`,
    meta: {
      healthOk: status.healthOk,
      grok: Boolean(status.grokPath),
      gctoac: Boolean(status.gctoacPath),
      keyCreated,
      keyReady
    }
  })
  return {
    ...status,
    keyReady,
    keyCreated,
    // Never return the plaintext key to the renderer
    baseUrl: gw.baseUrl
  }
})

reg('gateway:installHints', async () => {
  const {
    GrokGatewayService
  } = await import('../infrastructure/gateway/GrokGatewayService')
  return {
    grokBuildUrl: GrokGatewayService.grokBuildInstallUrl(),
    gatewayDocsUrl: GrokGatewayService.gatewayDocsUrl(),
    installCommand: GrokGatewayService.grokBuildInstallCommand()
  }
})

reg('gateway:openAdmin', async (url?: string) => {
  const {
    getGrokGatewayService
  } = await import('../infrastructure/gateway/GrokGatewayService')
  const gw = getGrokGatewayService()
  const st = await gw.ensureRunning()
  const target =
    (typeof url === 'string' && url.trim()) ||
    st.adminUrl ||
    gw.adminUrl
  if (host.openAdminWindow) {
    return host.openAdminWindow(target)
  }
  await host.shell.openExternal(target)
  return {
    ok: true as const,
    url: target,
    reused: false as const,
    state: st.state,
    healthOk: st.healthOk,
    via: 'external' as const
  }
})

reg(
  'ai:probeVideo',
  (async () => ctx.aiClient.videoProvider.probe())
)

reg(
  'ai:probeChat',
  (async () => ctx.aiClient.probeChat())
)

reg(
  'ai:listModels',
  (async () => ctx.aiClient.listModels())
)

reg(
  'ai:testChat',
  (async ( prompt?: string) => ctx.aiClient.testChat(prompt))
)

reg(
  'ai:applyLlmPreset',
  (async ( preset: string) => {
    const {
      applyLlmPreset,
      coerceLlmProviderPreset
    } = await import('../domain/openaiCompatible')
    const current = settingsStore.load()
    const id = coerceLlmProviderPreset(preset, current.baseUrl)
    const patched = applyLlmPreset(current, id)
    const next = settingsStore.save({
      llmProvider: patched.llmProvider,
      baseUrl: patched.baseUrl,
      videoPath: patched.videoPath,
      model: patched.model
    })
    rebindAi(next)
    if (id === 'grok-gateway') {
      void import('../infrastructure/gateway/GrokGatewayService')
        .then(({ getGrokGatewayService }) =>
          getGrokGatewayService().ensureRunning()
        )
        .catch(() => undefined)
    }
    activity.append({
      kind: 'settings',
      message: `llm preset → ${id}`,
      meta: { baseUrl: next.baseUrl }
    })
    return next
  })
)

/** @deprecated alias — same as applyLlmPreset('grok-gateway') */
reg(
  'ai:applyGrokDefaults',
  (async () => {
    const { applyLlmPreset } = await import('../domain/openaiCompatible')
    const current = settingsStore.load()
    const patched = applyLlmPreset(current, 'grok-gateway')
    const next = settingsStore.save({
      llmProvider: patched.llmProvider,
      baseUrl: patched.baseUrl,
      videoPath: patched.videoPath,
      model: patched.model
    })
    rebindAi(next)
    return next
  })
)

}
