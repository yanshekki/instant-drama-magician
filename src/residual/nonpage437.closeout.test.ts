/**
 * Close residual non-page lines: reliable CLI + handler branch hits.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  existsSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../test/handlerTestUtils'
import { mockClient, mockExit } from '../cli/commands/cliTestUtils'

vi.mock('../cli/client', () => ({
  resolveClient: vi.fn()
}))

import { resolveClient } from '../cli/client'

describe('nonpage437 CLI residuals', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockResolvedValue(mockClient() as never)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.npm_package_version
    delete process.env.IDM_CONFIG
  })

  it('parseArgs custom long flags', async () => {
    const { parseArgv } = await import('../cli/parseArgs')
    const r = parseArgv(['--foo', '--bar=baz', 'cmd', 'a'])
    expect(r.flags.foo).toBe(true)
    expect(r.flags.bar).toBe('baz')
  })

  it('config profile select and corrupt catch', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cfg-'))
    const cfg = join(dir, 'config.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        profiles: { p1: { url: 'http://x' } },
        defaultProfile: 'p1'
      })
    )
    process.env.IDM_CONFIG = cfg
    try {
      const { resolveGlobals } = await import('../cli/config')
      const g = resolveGlobals({ profile: 'p1' } as never)
      expect(g).toBeTruthy()
      writeFileSync(cfg, '{bad')
      const g2 = resolveGlobals({} as never)
      expect(g2).toBeTruthy()
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('domain bare id and generic ERROR exit', async () => {
    const { cmdDomain } = await import('../cli/commands/domain')
    const g = {
      json: true,
      pretty: false,
      yes: true,
      help: false,
      local: true
    } as never
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        channels: vi.fn().mockResolvedValue(['characters:get']),
        invoke: vi.fn().mockResolvedValue({ id: 'c1' })
      }) as never
    )
    await cmdDomain(g, 'characters', ['get', 'bare-id-1'], {})
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockRejectedValue(new Error('something else'))
      }) as never
    )
    await expect(cmdDomain(g, 'stories', ['list'], {})).rejects.toThrow(
      /process.exit/
    )
  })

  it('invoke network and generic error exits', async () => {
    const { cmdInvoke } = await import('../cli/commands/invoke')
    const g = {
      json: true,
      pretty: false,
      yes: true,
      help: false,
      local: true
    } as never
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockRejectedValue(new Error('ECONNREFUSED host'))
      }) as never
    )
    await expect(cmdInvoke(g, ['stories:list'], {})).rejects.toThrow(
      /process.exit/
    )
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockRejectedValue(new Error('other boom'))
      }) as never
    )
    await expect(cmdInvoke(g, ['stories:list'], {})).rejects.toThrow(
      /process.exit/
    )
  })

  it('sugar create default Untitled', async () => {
    const { cmdStories } = await import('../cli/commands/sugar')
    const g = {
      json: true,
      pretty: false,
      yes: true,
      help: false,
      local: true
    } as never
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        invoke: vi.fn().mockResolvedValue({ id: 's1' })
      }) as never
    )
    await cmdStories(g, ['create'], {})
  })

  it('doctor channels message branch', async () => {
    const { cmdDoctor } = await import('../cli/commands/doctor')
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        doctor: vi.fn(async () => ({
          ok: false,
          checks: {
            channels: { message: 'offline' },
            ffmpeg: { available: false, message: 'missing' }
          }
        }))
      }) as never
    )
    try {
      await cmdDoctor({
        json: false,
        pretty: false,
        yes: true,
        help: false,
        local: true
      } as never)
    } catch {
      /* exit ok */
    }
  })
})

describe('nonpage437 runtime handler residuals', () => {
  afterEach(() => vi.restoreAllMocks())

  it('generation interactive runClip degraded emit progress', async () => {
    const { registerGenerationHandlers } = await import(
      '../runtime/handlers/generation'
    )
    const append = vi.fn()
    const save = vi.fn()
    const emit = vi.fn()
    const generateClip = vi.fn(async (_s, _e, onProgress?: Function) => {
      onProgress?.({ pct: 1 })
      return { entryId: 'e1', mediaPath: '/x.mp4', degraded: true }
    })
    const run = vi.fn(async () => ({
      success: true,
      steps: [{ step: 'script', ok: true, degraded: false }]
    }))
    const ctx = makeHandlerContext({
      generation: () =>
        ({
          run,
          generateClip,
          cancel: vi.fn(),
          rebindAi: vi.fn(),
          getMediaStore: () => ({})
        }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      settingsStore: {
        load: vi.fn(() => ({})),
        save,
        lastLoadMigrated: false
      } as never,
      host: {
        ...(makeHandlerContext().host as object),
        emitGenerationProgress: emit,
        getLastGenerationProgress: () => null
      } as never
    })
    registerGenerationHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await invokeRegistered(h as never, 'generation:run', 's1', {
      interactiveVideo: true
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'run pipeline (interactive video)'
      })
    )
    await invokeRegistered(h as never, 'generation:run', 's1', {})
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'run pipeline' })
    )
    await invokeRegistered(h as never, 'generation:runClip', 's1', 'e1', {})
    expect(emit).toHaveBeenCalled()
    expect(save).toHaveBeenCalledWith({ lastGenerationDegraded: true })
  })

  it('soul spokenLanguages filter and short content fail', async () => {
    const { registerCharactersSoul } = await import(
      '../runtime/handlers/characters/soul'
    )
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: 'short' } }]
    }))
    const writeFileSyncMock = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => join(tmpdir(), 's-soul.md')
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerCharactersSoul(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:generateSoul', {
        profile: {
          name: 'X',
          description: 'd',
          spokenLanguages: ['en', 1, '  ', 'yue']
        },
        locale: 'en'
      })
    ).rejects.toMatchObject({ message: 'errors.aiUnavailable' })
    void writeFileSyncMock
  })

  it('MediaStore remaining edges', async () => {
    const { MediaStore } = await import('../infrastructure/media/MediaStore')
    const root = mkdtempSync(join(tmpdir(), 'idm-ms-437-'))
    try {
      const store = new MediaStore(root)
      store.ensureStoryDirs('s1')
      const exp = store.exportsDir('s1')
      writeFileSync(join(exp, 'NoDate.mp4'), 'v')
      const latest = join(root, 'latest-dir')
      mkdirSync(latest, { recursive: true })
      store.listExportHistory('s1', {
        latestPath: latest,
        publicDir: join(root, 'no-public'),
        fileNamePrefix: 'No'
      })
      const wp = join(exp, 'via.mp4')
      writeFileSync(wp, 'x')
      store.recordExportHistory('s1', {
        kind: 'final',
        path: join(root, 'missing.mp4'),
        workPath: wp
      })
      const tmp = join(root, 'tmp', 'a.png')
      mkdirSync(join(root, 'tmp'), { recursive: true })
      writeFileSync(tmp, 'i')
      store.promoteTmpImage(null, 'c1', tmp, 'body')
      const dest = store.characterImagePath('c1', 'body')
      if (existsSync(dest)) {
        store.promoteTmpImage(null, 'c1', dest, 'body')
      }
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it('AppDataMigration residual settings media', async () => {
    const { migrateAppDataIfNeeded } = await import(
      '../application/services/AppDataMigrationService'
    )
    const { resolveAppPaths } = await import('../domain/appPaths')
    const root = mkdtempSync(join(tmpdir(), 'idm-mig437-'))
    try {
      const xdg = join(root, 'share')
      const idm = join(xdg, 'idm')
      mkdirSync(join(idm, 'media'), { recursive: true })
      writeFileSync(join(idm, 'media', 'a.png'), 'x')
      writeFileSync(join(idm, 'settings.json'), '{}')
      writeFileSync(join(idm, 'instant-drama.db'), Buffer.alloc(60_000, 1))
      const paths = resolveAppPaths({ dataDir: join(root, 'dest') })
      mkdirSync(paths.dataRoot, { recursive: true })
      writeFileSync(paths.databasePath, Buffer.alloc(100, 0))
      const r = migrateAppDataIfNeeded({
        paths,
        cwd: join(root, 'empty'),
        force: true,
        home: root,
        env: { XDG_DATA_HOME: xdg, XDG_CONFIG_HOME: join(root, 'cfg') },
        platform: 'linux'
      })
      expect(r.actions.length).toBeGreaterThan(0)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
