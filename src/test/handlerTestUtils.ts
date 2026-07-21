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
  } = {}
): HandlerContext & { handlers?: RegisteredMap } {
  const { handlers, reg } = createRegCapture()
  const noopService = () => ({
    list: vi.fn(async () => []),
    listForStory: vi.fn(async () => []),
    get: vi.fn(async (id: string) => ({ id })),
    create: vi.fn(async (input: unknown) => input),
    update: vi.fn(async (id: string, data: unknown) => ({ id, ...(data as object) })),
    delete: vi.fn(async (id: string) => ({ id }))
  })

  const ctx = {
    reg: overrides.reg ?? reg,
    host: overrides.host ?? ({
      mode: 'headless',
      userData: '/tmp/idm-test',
      mediaRoot: '/tmp/idm-test/media',
      appVersion: 'test',
      isPackaged: false,
      platform: 'linux',
      getPrisma: vi.fn(),
      settingsStore: {
        load: vi.fn(() => ({})),
        save: vi.fn((p: unknown) => p),
        lastLoadMigrated: false
      },
      activity: { append: vi.fn() },
      dialog: {},
      shell: {},
      getMainWindow: () => null
    } as never),
    settingsStore: overrides.settingsStore ?? ({
      load: vi.fn(() => ({})),
      save: vi.fn((p: unknown) => p),
      lastLoadMigrated: false
    } as never),
    activity: overrides.activity ?? ({ append: vi.fn() } as never),
    get settings() {
      return {} as never
    },
    get aiClient() {
      return {
        chat: vi.fn(),
        generateImage: vi.fn(),
        generateVideo: undefined
      } as never
    },
    rebindAi: overrides.rebindAi ?? vi.fn(),
    mediaRoot: overrides.mediaRoot ?? (() => '/tmp/idm-test/media'),
    userDataPath: overrides.userDataPath ?? (() => '/tmp/idm-test'),
    stories: overrides.stories ?? (noopService as never),
    characters: overrides.characters ?? (noopService as never),
    scenes: overrides.scenes ?? (noopService as never),
    props: overrides.props ?? (noopService as never),
    actions: overrides.actions ?? (noopService as never),
    costumes: overrides.costumes ?? (noopService as never),
    timeline: overrides.timeline ?? (noopService as never),
    generation: overrides.generation ?? (() => ({
      getMediaStore: () => ({
        tmpPath: () => '/tmp/x.png',
        characterImagePath: () => '/tmp/c.png',
        sceneImagePath: () => '/tmp/s.png'
      }),
      cancel: vi.fn(),
      rebindAi: vi.fn()
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
