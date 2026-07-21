import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerScenesAtmosphere } from './atmosphere'

describe('registerScenesAtmosphere', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesAtmosphere(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:swapAtmosphere')).toBe(true)
  })

  it('validates atmosphere description and base plate', async () => {
    const ctx = makeHandlerContext({
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            description: 'alley',
            refGalleryJson: null,
            refImagePath: null
          }))
        }) as never
    })
    registerScenesAtmosphere(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'scenes:swapAtmosphere', {
        sceneId: 'sc1',
        atmosphereDescription: '  '
      })
    ).rejects.toMatchObject({ message: 'errors.atmosphereRequired' })
    await expect(
      invokeRegistered(h as never, 'scenes:swapAtmosphere', {
        sceneId: 'sc1',
        atmosphereDescription: 'heavy rain neon night'
      })
    ).rejects.toMatchObject({
      message: 'errors.atmosphereBasePlateRequired'
    })
  })

  it('swaps atmosphere as draft', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-atmo-'))
    const base = join(dir, 'base.png')
    const out = join(dir, 'atmo.png')
    writeFileSync(base, 'base')
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('ATMO').toString('base64')
    }))
    const gallery = [
      {
        id: 'g1',
        path: base,
        kind: 'sheet',
        label: 'Hero plate',
        createdAt: '2020-01-01',
        layer: 'hero'
      }
    ]
    const get = vi.fn(async () => ({
      id: 'sc1',
      title: 'Alley',
      description: 'narrow alley',
      setDressing: 'puddles',
      visualTags: 'wet',
      hardRules: null,
      artStyle: 'photo_cinematic',
      refGalleryJson: JSON.stringify(gallery),
      refImagePath: base
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const ctx = makeHandlerContext({
      aiClient: { editImage, generateImage: vi.fn(), chat: vi.fn() },
      scenes: () => ({ get, update }) as never,
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
    registerScenesAtmosphere(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:swapAtmosphere', {
      sceneId: 'sc1',
      atmosphereDescription: 'heavy rain night neon',
      baseImagePath: base,
      persist: false
    })) as { path?: string; draft?: boolean }
    expect(editImage).toHaveBeenCalled()
    expect(r.path || existsSync(out)).toBeTruthy()

    // persist + artStyle update + detail pose (square)
    const r2 = (await invokeRegistered(h as never, 'scenes:swapAtmosphere', {
      sceneId: 'sc1',
      atmosphereDescription: 'foggy morning',
      baseImagePath: base,
      persist: true,
      artStyle: 'anime',
      pose: 'detail'
    })) as { draft?: boolean }
    expect(r2.draft).toBe(false)
    expect(update).toHaveBeenCalled()
  })
})
