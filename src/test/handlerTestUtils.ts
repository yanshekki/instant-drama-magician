/**
 * Helpers for unit-testing register*Handlers modules with a mock HandlerContext.
 */
import { vi } from 'vitest'
import type { HandlerContext } from '../runtime/handlers/context'
import type { RuntimeHandler } from '../runtime/createRuntime'

export type RegisteredMap = Map<string, RuntimeHandler>

export function createRegCapture(): {
  handlers: RegisteredMap
  reg: (channel: string, fn: RuntimeHandler) => void
} {
  const handlers: RegisteredMap = new Map()
  return {
    handlers,
    reg: (channel, fn) => {
      handlers.set(channel, fn)
    }
  }
}

/** Minimal HandlerContext; override services as needed. */
export function makeHandlerContext(
  overrides: Partial<HandlerContext> & {
    reg?: (channel: string, fn: RuntimeHandler) => void
    /** Override live AI client (chat / generateVideo / getStatus …). */
    aiClient?: unknown
  } = {}
): HandlerContext & { handlers?: RegisteredMap } {
  const { handlers, reg } = createRegCapture()
  const noopService = () => ({
    list: vi.fn(async () => []),
    listForStory: vi.fn(async () => []),
    get: vi.fn(async (id: string) => ({ id })),
    create: vi.fn(async (input: unknown) => input),
    update: vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    })),
    delete: vi.fn(async (id: string) => ({ id })),
    reorder: vi.fn(async () => ({ ok: true })),
    setMedia: vi.fn(async (id: string, data: unknown) => ({ id, ...(data as object) }))
  })

  const defaultActivity = {
    append: vi.fn(),
    readRecent: vi.fn(() => [{ kind: 'x', message: 'm', ts: 't' }]),
    query: vi.fn(() => [{ kind: 'ipc', message: 'q', ts: 't' }]),
    clear: vi.fn(() => ({ ok: true as const, path: '/tmp/log' })),
    kinds: vi.fn(() => ['ipc', 'generation']),
    path: '/tmp/idm-test/logs/activity.jsonl'
  }

  const defaultGeneration = {
    getMediaStore: () => ({
      tmpPath: () => '/tmp/x.png',
      characterImagePath: () => '/tmp/c.png',
      sceneImagePath: () => '/tmp/s.png',
      ensureLibraryDirs: vi.fn()
    }),
    cancel: vi.fn(),
    rebindAi: vi.fn(),
    run: vi.fn(async () => ({
      success: true,
      steps: [{ name: 'x', degraded: false }]
    })),
    generateClip: vi.fn(async () => ({
      path: '/tmp/clip.mp4',
      degraded: false
    })),
    exportStoryboard: vi.fn(async () => ({ outputPath: '/tmp/sb.mp4' })),
    exportConcat: vi.fn(async () => ({ outputPath: '/tmp/cat.mp4' })),
    exportFinal: vi.fn(async () => ({ outputPath: '/tmp/final.mp4' })),
    listExports: vi.fn(async () => []),
    deleteExport: vi.fn(async () => ({ ok: true })),
    exportPreflight: vi.fn(async () => ({ ok: true, clips: 0 }))
  }

  const defaultSettingsStore = {
    load: vi.fn(() => ({
      uiLanguage: 'zh-HK',
      llmProvider: 'grok-gateway',
      videoMode: 'auto',
      apiKey: '',
      webServerEnabled: false
    })),
    save: vi.fn((p: unknown) => ({
      uiLanguage: 'zh-HK',
      llmProvider: 'grok-gateway',
      videoMode: 'auto',
      apiKey: '',
      webServerEnabled: false,
      ...(p as object)
    })),
    lastLoadMigrated: false
  }

  const defaultHost = {
    mode: 'headless' as const,
    userData: '/tmp/idm-test',
    mediaRoot: '/tmp/idm-test/media',
    appVersion: 'test',
    isPackaged: false,
    platform: 'linux',
    getPrisma: vi.fn(),
    settingsStore: defaultSettingsStore,
    activity: defaultActivity,
    dialog: {
      showOpenDialog: vi.fn(async () => ({
        canceled: true,
        filePaths: [] as string[]
      })),
      showSaveDialog: vi.fn(async () => ({
        canceled: true,
        filePath: undefined as string | undefined
      }))
    },
    shell: {
      openExternal: vi.fn(async () => undefined),
      openPath: vi.fn(async () => ''),
      showItemInFolder: vi.fn()
    },
    getMainWindow: () => null,
    emitGenerationProgress: vi.fn(),
    getLastGenerationProgress: vi.fn(() => null),
    rebuildApplicationMenu: vi.fn()
  }

  let settingsSnapshot = defaultSettingsStore.load()
  const rebindAi =
    overrides.rebindAi ??
    vi.fn((next: unknown) => {
      settingsSnapshot = next as never
    })

  const ctx = {
    reg: overrides.reg ?? reg,
    host: overrides.host ?? (defaultHost as never),
    settingsStore: overrides.settingsStore ?? (defaultSettingsStore as never),
    activity: overrides.activity ?? (defaultActivity as never),
    get settings() {
      return settingsSnapshot as never
    },
    get aiClient() {
      if (overrides.aiClient) return overrides.aiClient as never
      return {
        chat: vi.fn(),
        generateImage: vi.fn(async () => ({
          b64: Buffer.from('img').toString('base64')
        })),
        editImage: vi.fn(async () => ({
          b64: Buffer.from('img').toString('base64')
        })),
        generateVideo: undefined,
        getStatus: vi.fn(async () => ({
          available: true,
          message: 'ok'
        })),
        probeChat: vi.fn(async () => ({ ok: true })),
        videoProvider: {
          probe: vi.fn(async () => ({
            id: 'stub',
            available: true,
            message: 'ok'
          }))
        },
        listModels: vi.fn(async () => [])
      } as never
    },
    rebindAi,
    mediaRoot: overrides.mediaRoot ?? (() => '/tmp/idm-test/media'),
    userDataPath: overrides.userDataPath ?? (() => '/tmp/idm-test'),
    stories: overrides.stories ?? (noopService as never),
    characters: overrides.characters ?? (noopService as never),
    scenes: overrides.scenes ?? (noopService as never),
    props: overrides.props ?? (noopService as never),
    actions: overrides.actions ?? (noopService as never),
    costumes: overrides.costumes ?? (noopService as never),
    timeline: overrides.timeline ?? (noopService as never),
    generation:
      overrides.generation ??
      (() =>
        ({
          ...defaultGeneration,
          getMediaStore: () => ({
            tmpPath: () => '/tmp/x.png',
            tmpImagePath: (prefix: string, ext = '.png') =>
              `/tmp/${prefix}${ext}`,
            characterImagePath: () => '/tmp/c.png',
            sceneImagePath: () => '/tmp/s.png',
            characterVideoPath: (id: string) => `/tmp/char_${id}.mp4`,
            sceneVideoPath: (id: string) => `/tmp/scene_${id}.mp4`,
            propVideoPath: (id: string) => `/tmp/prop_${id}.mp4`,
            costumeVideoPath: (id: string) => `/tmp/cos_${id}.mp4`,
            actionVideoPath: (id: string) => `/tmp/act_${id}.mp4`,
            clipPath: (s: string, e: string) => `/tmp/clip_${s}_${e}.mp4`,
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            writeStoryCastPrepJson: vi.fn(),
            readStoryCastPrepJson: vi.fn(() => null)
          })
        }) as never)
  } as HandlerContext

  return Object.assign(ctx, { handlers })
}

export async function invokeRegistered(
  handlers: RegisteredMap,
  channel: string,
  ...args: unknown[]
): Promise<unknown> {
  const fn = handlers.get(channel)
  if (!fn) throw new Error(`channel not registered: ${channel}`)
  return fn(...args)
}
