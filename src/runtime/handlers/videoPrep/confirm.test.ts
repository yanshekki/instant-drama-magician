import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerVideoPrepConfirm } from './confirm'

describe('registerVideoPrepConfirm', () => {
  let dir: string | undefined

  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerVideoPrepConfirm(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('videoPrep:confirm')).toBe(true)
  })

  it('rejects when video unavailable or still missing', async () => {
    const ctx = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat: vi.fn() }
    })
    registerVideoPrepConfirm(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:confirm', {
        kind: 'character-intro',
        professionalPrompt: 'PRO',
        stillPath: '/nope.png'
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })

    dir = mkdtempSync(join(tmpdir(), 'idm-vp-'))
    const still = join(dir, 'still.png')
    // still missing path
    const genVideo = vi.fn()
    const ctx2 = makeHandlerContext({
      aiClient: { generateVideo: genVideo, chat: vi.fn() }
    })
    registerVideoPrepConfirm(ctx2)
    const h2 = (ctx2 as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h2 as never, 'videoPrep:confirm', {
        kind: 'character-intro',
        professionalPrompt: 'PRO',
        stillPath: still
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })
  })

  it('confirms character-intro video generation', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vp2-'))
    const still = join(dir, 'still.png')
    writeFileSync(still, 'png')
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const append = vi.fn()
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      hardRules: '【禁止】水印',
      refGalleryJson: JSON.stringify([
        {
          id: 'g1',
          path: still,
          kind: 'sheet',
          label: 'Sheet',
          createdAt: '2020-01-01'
        }
      ]),
      refImagePath: still
    }))
    const ctx = makeHandlerContext({
      aiClient: { generateVideo, chat: vi.fn() },
      characters: () =>
        ({
          get,
          update
        }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerVideoPrepConfirm(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:confirm', {
      kind: 'character-intro',
      characterId: 'c1',
      professionalPrompt: 'PROFESSIONAL SHORT DRAMA INTRO PROMPT HERE',
      userExtraPrompt: 'warmer light',
      stillPath: still,
      durationSeconds: 8,
      aspectRatio: '16:9'
    })) as { path: string; promptUsed: string }
    expect(generateVideo).toHaveBeenCalled()
    expect(r.path).toMatch(/\.mp4$/)
    expect(r.promptUsed).toMatch(/PROFESSIONAL|warmer|禁止|HARD/)
  })
})
