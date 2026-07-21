/**
 * Shared mutable context for all IPC/CLI/web channel handlers.
 */
import { GrokCliClient } from '../../infrastructure/ai/GrokCliClient'
import {
  ActionService,
  CharacterService,
  CostumeService,
  GenerationService,
  PropService,
  SceneService,
  StoryService,
  TimelinePersistenceService
} from '../../application/services'
import type { AppSettings } from '../../types/settings'
import type { RuntimeHandler } from '../createRuntime'
import type { HandlerHost } from '../HandlerHost'
import type { ActivityLog } from '../../infrastructure/activity/ActivityLog'
import type { SettingsStore } from '../../infrastructure/settings/SettingsStore'

export type HandlerContext = {
  reg: (channel: string, fn: RuntimeHandler) => void
  host: HandlerHost
  settingsStore: SettingsStore
  activity: ActivityLog
  /** Live settings (updated via rebindAi) */
  get settings(): AppSettings
  /** Live AI client (updated via rebindAi) */
  get aiClient(): GrokCliClient
  rebindAi: (next: AppSettings) => void
  mediaRoot: () => string
  userDataPath: () => string
  stories: () => StoryService
  characters: () => CharacterService
  scenes: () => SceneService
  props: () => PropService
  actions: () => ActionService
  costumes: () => CostumeService
  timeline: () => TimelinePersistenceService
  generation: () => GenerationService
}

export function createHandlerContext(
  reg: (channel: string, fn: RuntimeHandler) => void,
  host: HandlerHost
): HandlerContext {
  const settingsStore = host.settingsStore
  let settings = settingsStore.load()
  let aiClient = new GrokCliClient(settings)
  const mediaRoot = (): string => host.mediaRoot
  const activity = host.activity

  const stories = (): StoryService => new StoryService(host.getPrisma())
  const characters = (): CharacterService =>
    new CharacterService(host.getPrisma())
  const scenes = (): SceneService => new SceneService(host.getPrisma())
  const props = (): PropService => new PropService(host.getPrisma())
  const actions = (): ActionService => new ActionService(host.getPrisma())
  const costumes = (): CostumeService => new CostumeService(host.getPrisma())
  const timeline = (): TimelinePersistenceService =>
    new TimelinePersistenceService(host.getPrisma())

  let generationService: GenerationService | null = null
  const generation = (): GenerationService => {
    if (!generationService) {
      generationService = new GenerationService(host.getPrisma(), aiClient, {
        mediaRoot: mediaRoot(),
        settings
      })
    }
    return generationService
  }

  const rebindAi = (next: AppSettings): void => {
    settings = next
    aiClient = new GrokCliClient(settings)
    generation().rebindAi(aiClient, settings)
  }

  const userDataPath = (): string => host.userData

  return {
    reg,
    host,
    settingsStore,
    activity,
    get settings() {
      return settings
    },
    get aiClient() {
      return aiClient
    },
    rebindAi,
    mediaRoot,
    userDataPath,
    stories,
    characters,
    scenes,
    props,
    actions,
    costumes,
    timeline,
    generation
  }
}
