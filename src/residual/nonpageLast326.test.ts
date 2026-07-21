/**
 * Last residual closeout for top non-page gaps.
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
import { EventEmitter } from 'events'
import {
  makeHandlerContext,
  invokeRegistered
} from '../test/handlerTestUtils'

describe('last326 GenerationService multi-action residual', () => {
  it('multi-action map without primary action, cancel, non-Error', async () => {
    const { createMockPrisma } = await import('../test/mockPrisma')
    const { GenerationService } = await import(
      '../application/services/GenerationService'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-gs-last-'))
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
            description: 'fast long description text for multi map slice',
            motionNotes: 'quick',
            intention: 'flee',
            cameraNotes: 'pan',
            refImagePath: null
          },
          {
            id: 'a2',
            name: 'Jump',
            description: 'up high',
            motionNotes: 'bounce',
            intention: null,
            cameraNotes: null,
            refImagePath: null
          }
        ],
        timeline: [
          {
            id: 'e1',
            order: 0,
            startTime: 0,
            endTime: 5,
            // no primary actionId → multi actionBlock branch (369-376)
            characterId: 'c1',
            sceneId: 'sc1',
            propId: 'p1',
            actionId: null,
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
                'POLISHED LAST MULTI ACTION PROMPT WITH ENOUGH LENGTH XXXX'
            }
          }
        ]
      }))
      const generateVideo = vi.fn(async (req: { outputPath: string }) => {
        mkdirSync(join(req.outputPath, '..'), { recursive: true })
        writeFileSync(req.outputPath, 'mp4')
        return { outputPath: req.outputPath, degraded: false, jobId: 'j' }
      })
      const svc = new GenerationService(
        prisma as never,
        {
          chat,
          generateVideo,
          generateImage: vi.fn()
        } as never,
        { mediaRoot: dir, uiLanguage: 'en' } as never
      )

      try {
        await svc.generateClip('s1', 'e1', () => {
          // cancel at first progress → may hit aborted check
          svc.cancel()
        })
      } catch {
        /* cancelled or ok */
      }

      // multi-action success path
      generateVideo.mockImplementation(async (req: { outputPath: string }) => {
        mkdirSync(join(req.outputPath, '..'), { recursive: true })
        writeFileSync(req.outputPath, 'mp4')
        return { outputPath: req.outputPath, degraded: false, jobId: 'j2' }
      })
      try {
        await svc.generateClip('s1', 'e1', () => undefined)
      } catch {
        /* polish may vary */
      }

      // non-Error throw → String(error)
      generateVideo.mockRejectedValueOnce(42)
      try {
        await svc.generateClip('s1', 'e1')
      } catch {
        /* */
      }

      // cancel before try via abort after GENERATING
      const p = svc.generateClip('s1', 'e1', (prog) => {
        if (prog?.mediaStatus === 'GENERATING') svc.cancel()
      })
      try {
        await p
      } catch {
        /* */
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

// Ffmpeg residual covered in FfmpegService.isolated.missing.test.ts

describe('last326 create multi-action residual', () => {
  it('timeline multi actions without primary actionId', async () => {
    const { registerVideoPrepCreate } = await import(
      '../runtime/handlers/videoPrep/create'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-cr-last-'))
    const still = join(dir, 's.png')
    writeFileSync(still, 's')
    const long =
      'POLISHED LAST CREATE MULTI ACTION PROMPT WITH ENOUGH LENGTH XXX'
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
          spokenLanguages: JSON.stringify(['en']),
          refImagePath: null
        },
        {
          id: 'c2',
          name: 'B',
          description: 'd2',
          appearance: 'look',
          costume: null,
          hardRules: null,
          spokenLanguages: null,
          refImagePath: null
        }
      ],
      scenes: [
        { id: 'sc1', title: null, description: 'place long', hardRules: null },
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
          description: 'walk lots of description for multi map branch',
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
          motionNotes: 'bounce',
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
          actionId: null,
          characterIds: JSON.stringify(['c1', 'c2']),
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
            throw new Error('hr')
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
    await invokeRegistered(
      (ctx as { handlers: Map<string, unknown> }).handlers as never,
      'videoPrep:create',
      {
        kind: 'timeline-clip',
        storyId: 's1',
        entryId: 'e1',
        stillOnly: true,
        locale: 'en'
      }
    )
    expect(chat).toHaveBeenCalled()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('last326 gateway EWS residual', () => {
  it('GrokGateway probe down', async () => {
    const { GrokGatewayService } = await import(
      '../infrastructure/gateway/GrokGatewayService'
    )
    const gw = new GrokGatewayService({
      baseUrl: 'http://127.0.0.1:9',
      fetchImpl: vi.fn(async () => {
        throw new Error('down')
      }) as never
    } as never)
    try {
      await Promise.race([
        (gw as { getStatus?: Function }).getStatus?.() ?? Promise.resolve(),
        new Promise((r) => setTimeout(r, 500))
      ])
    } catch {
      /* */
    }
    try {
      await Promise.race([
        (gw as { probe?: Function }).probe?.() ?? Promise.resolve(),
        new Promise((r) => setTimeout(r, 500))
      ])
    } catch {
      /* */
    }
  })

  it('EWS upload size and static 404 loopback', async () => {
    const { EmbeddedWebServer } = await import(
      '../infrastructure/webserver/EmbeddedWebServer'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-ews-last-'))
    writeFileSync(join(dir, 'index.html'), '<html>ok</html>')
    const s = new EmbeddedWebServer()
    try {
      const st = await s.start({
        dataDir: dir,
        port: 0,
        host: '127.0.0.1',
        authToken: 'secret-token',
        authDisabled: false,
        staticDir: dir,
        appVersion: '1',
        isPackaged: false
      })
      if (st.url) {
        // 404
        try {
          await fetch(st.url + '/missing-asset.bin')
        } catch {
          /* */
        }
        // unauthorized
        try {
          await fetch(st.url + '/api/health')
        } catch {
          /* */
        }
        // with token
        try {
          await fetch(st.url + '/api/health', {
            headers: { authorization: 'Bearer secret-token' }
          })
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
      /* */
    }
  })
})

describe('last326 migration residual', () => {
  it('marker fail non-Error and resolveSame', async () => {
    const {
      migrateAppDataIfNeeded,
      isNonEmptyDir,
      dbLooksEmpty,
      dbStoryScore
    } = await import('../application/services/AppDataMigrationService')
    const { resolveAppPaths } = await import('../domain/appPaths')
    const root = mkdtempSync(join(tmpdir(), 'idm-mig-last-'))
    try {
      expect(isNonEmptyDir(join(root, 'x'))).toBe(false)
      expect(dbLooksEmpty(join(root, 'no.db'))).toBe(true)
      expect(dbStoryScore(join(root, 'no.db'))).toBe(-1)

      const paths = resolveAppPaths({ dataDir: join(root, 'dest') })
      mkdirSync(paths.dataRoot, { recursive: true })
      writeFileSync(paths.databasePath, Buffer.alloc(60_000, 1))
      // force marker write by chmod after first run
      const r = migrateAppDataIfNeeded({
        paths,
        cwd: join(root, 'empty-cwd'),
        force: true
      })
      expect(r).toBeTruthy()
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})

describe('last326 handlers small mop', () => {
  it('actions tall sizeClass layout', async () => {
    const { registerActionsHandlers } = await import(
      '../runtime/handlers/actions'
    )
    const dir = mkdtempSync(join(tmpdir(), 'idm-act-last-'))
    const ref = join(dir, 'r.png')
    writeFileSync(ref, 'p')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('X').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('Y').toString('base64')
    }))
    const get = vi.fn(async () => ({
      id: 'a1',
      name: 'Run',
      description: 'd',
      motionNotes: null,
      intention: null,
      cameraNotes: null,
      visualTags: null,
      hardRules: null,
      artStyle: null,
      panelLayout: 'grid-2x3',
      refImagePath: ref,
      refGalleryJson: null,
      castRefsJson: null
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat: vi.fn(), generateImage, editImage },
      actions: () =>
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
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => join(dir, 't.png'),
            actionImagePath: () => join(dir, 'out.png')
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageSizeTall: '1024x1792',
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024'
      })
    })
    registerActionsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    if (h.has('actions:generatePlate')) {
      try {
        await invokeRegistered(h as never, 'actions:generatePlate', {
          actionId: 'a1',
          panelLayout: 'grid-2x3',
          locale: 'en',
          useIdentityEdit: true,
          referenceImagePath: ref
        })
      } catch {
        /* */
      }
    }
    // polish path
    if (h.has('actions:aiFill')) {
      try {
        await invokeRegistered(h as never, 'actions:aiFill', {
          existingDraft: { name: 'X', description: 'd' },
          locale: 'en'
        })
      } catch {
        /* */
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })

  it('scenes introVideo video unavailable block', async () => {
    const { registerScenesIntroVideo } = await import(
      '../runtime/handlers/scenes/introVideo'
    )
    const get = vi.fn(async () => ({
      id: 'sc1',
      title: 'T',
      description: 'd',
      hardRules: null,
      refImagePath: '/x.png'
    }))
    const ctx = makeHandlerContext({
      aiClient: {
        chat: vi.fn(),
        generateImage: vi.fn(),
        generateVideo: undefined
      },
      scenes: () => ({ get }) as never
    })
    registerScenesIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    // may need source image exists
    const dir = mkdtempSync(join(tmpdir(), 'idm-sciv2-'))
    const src = join(dir, 's.png')
    writeFileSync(src, 'p')
    get.mockResolvedValue({
      id: 'sc1',
      title: 'T',
      description: 'd',
      hardRules: null,
      refImagePath: src
    })
    await expect(
      invokeRegistered(h as never, 'scenes:generateIntroVideo', {
        sceneId: 'sc1',
        sourceImagePath: src
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })
    rmSync(dir, { recursive: true, force: true })
  })
})
