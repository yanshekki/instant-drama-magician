import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerScenesPlate } from './plate'

describe('registerScenesPlate', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesPlate(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:generatePlate')).toBe(true)
    expect(handlers.has('scenes:commitPlate')).toBe(true)
  })

  it('generatePlate draft path', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-plate-'))
    const out = join(dir, 'plate.png')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('PLATE').toString('base64'),
      sizeUsed: '1792x1024',
      aspectUsed: '16:9'
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
      artStyle: 'photo_cinematic',
      refGalleryJson: null,
      refImagePath: null
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage: vi.fn(), chat: vi.fn() },
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
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => out,
            sceneImagePath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: false,
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024',
        imageSizeTall: '1024x1792'
      })
    })
    registerScenesPlate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:generatePlate', {
      sceneId: 'sc1',
      variant: 'establishing',
      persist: false
    })) as { draft: boolean; path: string }
    expect(generateImage).toHaveBeenCalled()
    expect(r.draft).toBe(true)
    expect(existsSync(r.path)).toBe(true)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generatePlateDraft' })
    )
  })
})
