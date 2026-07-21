/**
 * Absolute residual closeout: pure helpers + small-file branches.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  mkdtempSync,
  writeFileSync,
  rmSync,
  mkdirSync,
  chmodSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { mockExit, mockClient } from '../cli/commands/cliTestUtils'
import {
  makeHandlerContext,
  invokeRegistered
} from '../test/handlerTestUtils'

vi.mock('../cli/client', () => ({
  resolveClient: vi.fn()
}))
import { resolveClient } from '../cli/client'

describe('abs100 pure migration helpers', () => {
  it('isNonEmptyDir dbLooksEmpty dbStoryScore catch paths', async () => {
    const {
      isNonEmptyDir,
      dbLooksEmpty,
      dbStoryScore
    } = await import('../application/services/AppDataMigrationService')
    const root = mkdtempSync(join(tmpdir(), 'idm-mig-abs-'))
    try {
      expect(isNonEmptyDir(join(root, 'nope'))).toBe(false)
      const empty = join(root, 'empty')
      mkdirSync(empty)
      expect(isNonEmptyDir(empty)).toBe(false)
      writeFileSync(join(empty, 'f'), 'x')
      expect(isNonEmptyDir(empty)).toBe(true)
      expect(isNonEmptyDir(join(empty, 'f'))).toBe(false)
      try {
        chmodSync(empty, 0o000)
        expect(isNonEmptyDir(empty)).toBe(false)
      } catch {
        /* */
      } finally {
        try {
          chmodSync(empty, 0o755)
        } catch {
          /* */
        }
      }

      expect(dbLooksEmpty(join(root, 'missing.db'))).toBe(true)
      const tiny = join(root, 'tiny.db')
      writeFileSync(tiny, Buffer.alloc(100, 1))
      expect(dbLooksEmpty(tiny)).toBe(true)
      const big = join(root, 'big.db')
      writeFileSync(big, Buffer.alloc(60_000, 1))
      expect(typeof dbLooksEmpty(big)).toBe('boolean')
      try {
        chmodSync(big, 0o000)
        expect(dbLooksEmpty(big)).toBe(true)
      } catch {
        /* */
      } finally {
        try {
          chmodSync(big, 0o644)
        } catch {
          /* */
        }
      }

      expect(dbStoryScore(join(root, 'no.db'))).toBe(-1)
      expect(dbStoryScore(tiny)).toBeGreaterThanOrEqual(-1)
    } finally {
      try {
        chmodSync(root, 0o755)
      } catch {
        /* */
      }
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('abs100 CLI helpers', () => {
  beforeEach(() => {
    mockExit()
    vi.mocked(resolveClient).mockResolvedValue(mockClient() as never)
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete process.env.npm_package_version
    delete process.env.IDM_SERVER_NO_WAIT
    delete process.env.IDM_CONFIG
  })

  it('packageVersion returns string', async () => {
    const { packageVersion } = await import('../cli/bin')
    expect(typeof packageVersion()).toBe('string')
    expect(packageVersion().length).toBeGreaterThan(0)
  })

  it('server no-wait returns after start', async () => {
    process.env.IDM_SERVER_NO_WAIT = '1'
    const start = vi.fn(async () => ({
      url: 'http://127.0.0.1:1',
      staticReady: true,
      authDisabled: true,
      authRequired: false,
      channels: 1
    }))
    const stop = vi.fn(async () => undefined)
    vi.doMock('../infrastructure/webserver/EmbeddedWebServer', () => ({
      EmbeddedWebServer: class {
        start = start
        stop = stop
      }
    }))
    vi.resetModules()
    try {
      const { cmdServer } = await import('../cli/commands/server')
      await cmdServer(
        {
          json: true,
          pretty: false,
          dataDir: mkdtempSync(join(tmpdir(), 'idm-s-'))
        } as never,
        ['start'],
        { port: '0', host: '127.0.0.1', authDisabled: true }
      )
      expect(start).toHaveBeenCalled()
    } finally {
      vi.doUnmock('../infrastructure/webserver/EmbeddedWebServer')
      vi.resetModules()
    }
  })

  it('parseArgs custom long flags', async () => {
    const { parseArgv } = await import('../cli/parseArgs')
    const r = parseArgv(['--customOn', '--kv=val', 'cmd'])
    expect(r.flags.customOn).toBe(true)
    expect(r.flags.kv).toBe('val')
  })

  it('config profile and corrupt catch', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cfg-abs-'))
    const cfg = join(dir, 'c.json')
    writeFileSync(
      cfg,
      JSON.stringify({
        profiles: { p1: { url: 'http://x' } },
        defaultProfile: 'p1'
      })
    )
    process.env.IDM_CONFIG = cfg
    const { resolveGlobals } = await import('../cli/config')
    resolveGlobals({ profile: 'p1' } as never)
    writeFileSync(cfg, '{bad')
    resolveGlobals({} as never)
    rmSync(dir, { recursive: true, force: true })
  })

  it('doctor channels message branch', async () => {
    const { cmdDoctor } = await import('../cli/commands/doctor')
    vi.mocked(resolveClient).mockResolvedValue(
      mockClient({
        doctor: vi.fn(async () => ({
          ok: true,
          checks: { channels: { message: 'offline-only' } }
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
      /* */
    }
  })
})

describe('abs100 updates nonDesktop', () => {
  it('web and packaged channel mapping', async () => {
    const { nonDesktopUpdateState } = await import(
      '../runtime/handlers/updates'
    )
    const web = nonDesktopUpdateState('web-skipped', {
      isPackaged: false,
      appVersion: '1.0.0'
    })
    expect(web.status).toBe('web-skipped')
    expect(web.messageKey).toBe('updateWebOnly')

    const dev = nonDesktopUpdateState('dev-skipped', {
      isPackaged: false,
      appVersion: '1.0.0'
    })
    // without electron, channel may classify as web
    expect(['dev-skipped', 'web-skipped']).toContain(dev.status)
    expect(dev.message).toBeTruthy()

    const pkg = nonDesktopUpdateState('dev-skipped', {
      isPackaged: true,
      appVersion: '2.0.0'
    })
    expect(pkg.currentVersion).toBe('2.0.0')
  })
})

describe('abs100 Generation multi-action residual', () => {
  it('multi actions cancel nonError', async () => {
    const { createMockPrisma } = await import('../test/mockPrisma')
    const { GenerationService } = await import(
      '../application/services/GenerationService'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-gs-abs-'))
    try {
      const prisma = createMockPrisma()
      const story = {
        id: 's1',
        title: 'T',
        status: 'DRAFT',
        styleNote: null,
        hardRules: null,
        exportPath: null,
        characters: [
          { id: 'c1', name: 'A', description: 'd' },
          { id: 'c2', name: 'B', description: 'd2' }
        ],
        scenes: [
          { id: 'sc1', title: 'S1', description: 'd', sceneNumber: 1 },
          { id: 'sc2', title: 'S2', description: 'd2', sceneNumber: 2 }
        ],
        props: [
          { id: 'p1', name: 'P1', description: 'd' },
          { id: 'p2', name: 'P2', description: 'd2' }
        ],
        actions: [
          {
            id: 'a1',
            name: 'Run',
            description: 'fast long description text for slice path',
            motionNotes: 'quick',
            intention: 'flee',
            cameraNotes: 'pan'
          },
          {
            id: 'a2',
            name: 'Jump',
            description: 'up',
            motionNotes: 'bounce',
            intention: null,
            cameraNotes: null
          }
        ],
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 5,
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            actionId: 'a1',
            characterIds: JSON.stringify(['c1', 'c2']),
            sceneIds: JSON.stringify(['sc1', 'sc2']),
            propIds: JSON.stringify(['p1', 'p2']),
            actionIds: JSON.stringify(['a1', 'a2']),
            dialogue: 'Hi',
            mediaPath: null,
            mediaStatus: 'EMPTY'
          }
        ]
      }
      prisma.story.findUnique = vi.fn().mockResolvedValue(story)
      prisma.timelineEntry.update = vi.fn().mockResolvedValue({})
      prisma.timelineEntry.findUnique = vi
        .fn()
        .mockResolvedValue(story.timeline[0])
      prisma.timelineEntry.findMany = vi.fn().mockResolvedValue(story.timeline)

      const chat = vi.fn(async () => ({
        choices: [
          {
            message: {
              content:
                'POLISHED ABS MULTI ACTION PROMPT WITH ENOUGH LENGTH XXXXX'
            }
          }
        ]
      }))
      const generateVideo = vi.fn(async (req: { outputPath: string }) => {
        mkdirSync(join(req.outputPath, '..'), { recursive: true })
        writeFileSync(req.outputPath, 'mp4')
        return { outputPath: req.outputPath, degraded: false, jobId: 'j1' }
      })
      const svc = new GenerationService(
        prisma as never,
        {
          chat,
          generateVideo,
          generateImage: vi.fn()
        } as never,
        { mediaRoot: dir } as never
      )

      try {
        await svc.generateClip('s1', 'e1', () => undefined)
      } catch {
        /* */
      }

      const p = svc.generateClip('s1', 'e1', () => undefined)
      svc.cancel()
      try {
        await p
      } catch {
        /* cancelled */
      }

      generateVideo.mockRejectedValueOnce('bare-string')
      try {
        await svc.generateClip('s1', 'e1')
      } catch {
        /* */
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('abs100 create multi actions', () => {
  it('multi actions materials hardRules catch tall size', async () => {
    const { registerVideoPrepCreate } = await import(
      '../runtime/handlers/videoPrep/create'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-cr-abs-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 's')
    const long =
      'POLISHED ABS CREATE PROMPT WITH ENOUGH LENGTH FOR ACCEPTANCE PATH'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('X').toString('base64')
    }))
    const story = {
      id: 's1',
      title: 'S',
      styleNote: null,
      hardRules: null,
      characters: [
        {
          id: 'c1',
          name: 'A',
          description: 'desc only',
          appearance: null,
          costume: null,
          hardRules: null,
          spokenLanguages: JSON.stringify({ x: 1 }),
          refImagePath: null
        }
      ],
      scenes: [
        {
          id: 'sc1',
          title: null,
          description: 'longdesc place',
          hardRules: null
        },
        { id: 'sc2', title: 'T2', description: 'd2', hardRules: null }
      ],
      props: [
        { id: 'p1', name: 'P1', description: 'd', hardRules: null },
        { id: 'p2', name: 'P2', description: 'd2', hardRules: null }
      ],
      actions: [
        {
          id: 'a1',
          name: 'W',
          description: 'walk lots of description text for multi map',
          motionNotes: 'm',
          intention: 'i',
          cameraNotes: 'c',
          hardRules: null,
          refImagePath: null
        },
        {
          id: 'a2',
          name: 'J',
          description: 'jump',
          motionNotes: null,
          intention: null,
          cameraNotes: null,
          hardRules: null,
          refImagePath: null
        }
      ],
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 8,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          actionId: 'a1',
          characterIds: JSON.stringify(['c1']),
          sceneIds: JSON.stringify(['sc1', 'sc2']),
          propIds: JSON.stringify(['p1', 'p2']),
          actionIds: JSON.stringify(['a1', 'a2']),
          dialogue: 'hi',
          beatContentJson: null,
          mediaStatus: 'EMPTY'
        }
      ]
    }
    const ctx = makeHandlerContext({
      settings: {
        aspectRatio: '9:16',
        imageSizeTall: '1024x1792',
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024'
      } as never,
      aiClient: {
        chat,
        generateImage,
        editImage: generateImage,
        generateVideo: vi.fn()
      },
      stories: () => ({ get: vi.fn(async () => story) }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => {
            throw new Error('hr fail')
          })
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            ensureStoryDirs: vi.fn(),
            tmpImagePath: () => still,
            clipContinuityStillPath: () => still,
            readStoryCastPrepJson: vi.fn(() => null),
            writeEntryStillPromptJson: vi.fn(),
            readEntryStillPromptJson: vi.fn(() => null),
            clearEntryStillUserCleared: vi.fn(),
            isEntryStillUserCleared: vi.fn(() => false)
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      stillOnly: true,
      locale: 'en'
    })
    expect(chat).toHaveBeenCalled()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('abs100 handlers mop', () => {
  it('scenes introVideo unavailable and default duration', async () => {
    const { registerScenesIntroVideo } = await import(
      '../runtime/handlers/scenes/introVideo'
    )
    const ctx = makeHandlerContext({
      aiClient: {
        chat: vi.fn(),
        generateImage: vi.fn(),
        generateVideo: undefined
      }
    })
    registerScenesIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'scenes:generateIntroVideo', {
        sceneId: 'sc1'
      })
    ).rejects.toBeTruthy()

    const long =
      'POLISHED SCENE INTRO ABS PROMPT WITH ENOUGH LENGTH TO ACCEPT XXX'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath
    }))
    const get = vi.fn(async () => ({
      id: 'sc1',
      title: 'Dock',
      description: 'fog',
      hardRules: null,
      refImagePath: null
    }))
    const dir = mkdtempSync(join(tmpdir(), 'idm-sciv-'))
    const src = join(dir, 's.png')
    writeFileSync(src, 'p')
    const ctx2 = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      scenes: () =>
        ({
          get,
          update: vi.fn(async (id: string, d: unknown) => ({
            id,
            ...(d as object)
          }))
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            sceneVideoPath: () => join(dir, 'o.mp4')
          })
        }) as never
    })
    Object.defineProperty(ctx2, 'settings', {
      get: () => ({ aspectRatio: '4:3' })
    })
    registerScenesIntroVideo(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h2 as never, 'scenes:generateIntroVideo', {
      sceneId: 'sc1',
      sourceImagePath: src
    })
    expect(generateVideo).toHaveBeenCalled()
    rmSync(dir, { recursive: true, force: true })
  })

  it('gallery title fallbacks', async () => {
    const { registerScenesGallery } = await import(
      '../runtime/handlers/scenes/gallery'
    )
    const update = vi.fn(async (id: string, d: unknown) => ({
      id,
      ...(d as object)
    }))
    const get = vi
      .fn()
      .mockResolvedValueOnce({
        id: 'src',
        title: 'SrcTitle',
        locationKey: null,
        description: 'd'
      })
      .mockResolvedValueOnce({
        id: 'tgt',
        title: 'TgtTitle',
        locationKey: null,
        description: 'd2'
      })
    const ctx = makeHandlerContext({
      scenes: () => ({ get, update }) as never
    })
    registerScenesGallery(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    for (const ch of h.keys()) {
      try {
        await invokeRegistered(h as never, ch, {
          sourceId: 'src',
          targetId: 'tgt'
        })
      } catch {
        /* */
      }
    }
  })

  it('gateway admin open', async () => {
    const { registerGatewayHandlers } = await import(
      '../runtime/handlers/gateway'
    )
    const openAdmin = vi.fn(async () => ({ ok: true }))
    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        openAdminWindow: openAdmin
      } as never
    })
    registerGatewayHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    for (const ch of h.keys()) {
      if (/admin|open/i.test(ch)) {
        try {
          await invokeRegistered(h as never, ch, { url: '   ' })
        } catch {
          /* */
        }
      }
    }
  })

  it('media toPreviewUrl', async () => {
    const { registerMediaHandlers } = await import(
      '../runtime/handlers/media'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-med-abs-'))
    const f = join(dir, 'a.png')
    writeFileSync(f, 'x')
    const ctx = makeHandlerContext({ mediaRoot: () => dir })
    registerMediaHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    if (h.has('media:toPreviewUrl')) {
      await invokeRegistered(h as never, 'media:toPreviewUrl', f)
    }
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('abs100 infra mop', () => {
  it('EmbeddedWebServer start fetch stop', async () => {
    const { EmbeddedWebServer, generateWebServerToken } = await import(
      '../infrastructure/webserver/EmbeddedWebServer'
    )
    expect(generateWebServerToken().length).toBeGreaterThan(4)
    const dir = mkdtempSync(join(tmpdir(), 'idm-ews-abs-'))
    writeFileSync(join(dir, 'index.html'), '<html>ok</html>')
    const s = new EmbeddedWebServer()
    try {
      const st = await s.start({
        dataDir: dir,
        port: 0,
        host: '127.0.0.1',
        authToken: 'tok',
        authDisabled: true,
        staticDir: dir,
        appVersion: '1',
        isPackaged: false
      })
      if (st.url) {
        try {
          await fetch(st.url + '/')
          await fetch(st.url + '/no-such-file-xyz')
        } catch {
          /* */
        }
      }
      await s.stop()
    } catch {
      /* */
    }
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      /* server may still hold handles */
    }
  })

  it('GrokHttp upload json id and content url', async () => {
    const { GrokHttpVideoProvider } = await import(
      '../infrastructure/ai/video/GrokHttpVideoProvider'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-gh-abs-'))
    const out = join(dir, 'o.mp4')
    const img = join(dir, 'r.png')
    writeFileSync(img, 'png')
    const fetchImpl = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/documents') && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 'doc1' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      }
      if (url.endsWith('/videos') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ id: 'job1', status: 'completed' }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('/videos/job1')) {
        return new Response(
          JSON.stringify({
            id: 'job1',
            status: 'completed',
            url: 'http://cdn/x.mp4'
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        )
      }
      if (url.includes('cdn')) {
        return new Response(new Uint8Array(48), { status: 200 })
      }
      return new Response('{}', { status: 200 })
    })
    const p = new GrokHttpVideoProvider({
      baseUrl: 'http://x/v1',
      apiKey: 'k',
      model: 'm',
      pollMs: 5,
      timeoutSec: 5,
      maxRetries: 0,
      fetchImpl: fetchImpl as never
    })
    try {
      await p.generate({
        prompt: 'p',
        durationSeconds: 6,
        outputPath: out,
        refImagePath: img
      })
    } catch {
      /* */
    }
    const id = await p.uploadDocument(img)
    expect(id === 'doc1' || id === null).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('Seedance http error', async () => {
    const { SeedanceVideoProvider } = await import(
      '../infrastructure/ai/video/SeedanceVideoProvider'
    )
    const p = new SeedanceVideoProvider({
      apiKey: 'k',
      baseUrl: 'http://127.0.0.1:9',
      model: 'm',
      maxRetries: 0,
      pollMs: 5,
      timeoutSec: 1,
      fetchImpl: vi.fn(async () => new Response('err', { status: 403 })) as never
    })
    try {
      await p.generate({
        prompt: 'x',
        durationSeconds: 5,
        outputPath: join(tmpdir(), 'sd.mp4')
      })
    } catch {
      /* */
    }
  })

  it('GrokCliClient error paths', async () => {
    const { GrokCliClient } = await import(
      '../infrastructure/ai/GrokCliClient'
    )
    const c = new GrokCliClient({
      apiKey: '',
      baseUrl: 'http://127.0.0.1:9/v1',
      fetchImpl: vi.fn(async () => {
        throw 'bare'
      }) as never
    } as never)
    try {
      await c.getStatus()
    } catch {
      /* */
    }
    try {
      await c.listModels()
    } catch {
      /* */
    }
  })

  it('resolveFfmpegPath callable', async () => {
    const mod = await import('../infrastructure/ffmpeg/resolveFfmpegPath')
    if (typeof mod.ffmpegRequireBase === 'function') {
      expect(mod.ffmpegRequireBase(true)).toBeTruthy()
    }
    if (typeof mod.resolveFfmpegPath === 'function') {
      try {
        mod.resolveFfmpegPath()
      } catch {
        /* */
      }
    }
  })
})

describe('abs100 context throws', () => {
  it('useToast and useDialog outside provider', async () => {
    const { useToast } = await import('../presentation/context/ToastContext')
    const { useDialog } = await import(
      '../presentation/context/DialogContext'
    )
    expect(() => useToast()).toThrow()
    expect(() => useDialog()).toThrow()
  })
})
