import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersIntroVideo } from './introVideo'

describe('registerCharactersIntroVideo', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersIntroVideo(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:generateIntroVideo')).toBe(true)
  })

  it('validates source still and video capability', async () => {
    const ctx = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat: vi.fn() },
      characters: () =>
        ({
          get: vi.fn(async () => ({ id: 'c1', name: 'M' }))
        }) as never
    })
    registerCharactersIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:generateIntroVideo', {
        characterId: 'c1',
        sourceImagePath: '/missing.png'
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })

    dir = mkdtempSync(join(tmpdir(), 'idm-iv-'))
    const src = join(dir, 's.png')
    writeFileSync(src, 'x')
    await expect(
      invokeRegistered(h as never, 'characters:generateIntroVideo', {
        characterId: 'c1',
        sourceImagePath: src
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })
  })

  it('generates intro video and attaches to gallery', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-iv2-'))
    const src = join(dir, 's.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(src, 'png')
    const long =
      'POLISHED CHARACTER INTRO VIDEO PROMPT WITH ENOUGH CHARACTERS HERE'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'courier',
      appearance: 'short hair',
      costume: 'jacket',
      hardRules: 'NO logo',
      spokenLanguages: JSON.stringify(['yue']),
      soulMdPath: null,
      soulHubId: null,
      refGalleryJson: JSON.stringify([
        {
          id: 'g1',
          path: src,
          kind: 'sheet',
          label: 'Sheet',
          createdAt: '2020-01-01'
        }
      ]),
      refImagePath: src,
      refSheetPath: src
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      characters: () => ({ get, update }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '16:9' })
    })
    registerCharactersIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(
      h as never,
      'characters:generateIntroVideo',
      {
        characterId: 'c1',
        sourceImagePath: src,
        durationSeconds: 8,
        locale: 'en'
      }
    )) as { path: string; gallery: Array<{ introVideoPath?: string }> }
    expect(generateVideo).toHaveBeenCalled()
    expect(r.path).toBe(out)
    expect(update).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generateIntroVideo' })
    )
  })

  it('loads soul from file path and bad spokenLanguages', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-iv-soul-'))
    const src = join(dir, 's.png')
    const soul = join(dir, 'soul.md')
    const out = join(dir, 'out.mp4')
    writeFileSync(src, 'png')
    writeFileSync(soul, '# Soul\nbrave courier')
    const long =
      'POLISHED CHARACTER INTRO VIDEO PROMPT WITH ENOUGH CHARACTERS HERE'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'courier',
      spokenLanguages: '{bad',
      soulMdPath: soul,
      soulHubId: null,
      hardRules: null,
      refGalleryJson: null,
      refImagePath: src,
      refSheetPath: src
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo },
      characters: () => ({ get, update }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterVideoPath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '9:16' })
    })
    registerCharactersIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h as never, 'characters:generateIntroVideo', {
      characterId: 'c1',
      sourceImagePath: src,
      locale: 'zh-HK'
    })
    expect(generateVideo).toHaveBeenCalled()

    // soulHubId path via mocked hub
    get.mockResolvedValueOnce({
      id: 'c1',
      name: 'Ming',
      description: 'd',
      spokenLanguages: JSON.stringify(['en', 1]),
      soulMdPath: 'soulmd-hub://12',
      soulHubId: 12,
      hardRules: null,
      refGalleryJson: null,
      refImagePath: src,
      refSheetPath: src
    })
    vi.doMock('../../../infrastructure/soulmd/SoulMdHubClient', () => ({
      SoulMdHubClient: class {
        getSoul = async () => ({ content: 'hub soul', file_type: 'md' })
        static flattenContent = (c: string) => c
      }
    }))
    // may still work without mock if client fails → soulExcerpt empty
    await invokeRegistered(h as never, 'characters:generateIntroVideo', {
      characterId: 'c1',
      sourceImagePath: src,
      durationSeconds: 6
    })
  })
})
