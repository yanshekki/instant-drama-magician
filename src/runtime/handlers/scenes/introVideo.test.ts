import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerScenesIntroVideo } from './introVideo'

describe('registerScenesIntroVideo', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesIntroVideo(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:generateIntroVideo')).toBe(true)
  })

  it('validates source still and video', async () => {
    const ctx = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat: vi.fn() },
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            description: 'alley'
          }))
        }) as never
    })
    registerScenesIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'scenes:generateIntroVideo', {
        sceneId: 'sc1',
        sourceImagePath: ''
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })
  })

  it('generates scene intro video', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-siv-'))
    const src = join(dir, 's.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(src, 'png')
    const long =
      'POLISHED SCENE INTRO VIDEO PROMPT WITH ENOUGH CHARACTERS TO PASS'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'sc1',
      title: 'Pier',
      description: 'wet docks',
      hardRules: null,
      refGalleryJson: JSON.stringify([
        {
          id: 'g1',
          path: src,
          kind: 'sheet',
          label: 'Hero',
          createdAt: '2020-01-01'
        }
      ]),
      refImagePath: src
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      scenes: () => ({ get, update }) as never,
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
            sceneVideoPath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '16:9' })
    })
    registerScenesIntroVideo(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:generateIntroVideo', {
      sceneId: 'sc1',
      sourceImagePath: src,
      durationSeconds: 10,
      locale: 'en'
    })) as { path?: string; scene?: unknown }
    expect(generateVideo).toHaveBeenCalled()
    expect(r.path || update).toBeTruthy()
  })
})
