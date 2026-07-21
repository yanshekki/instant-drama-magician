import { describe, expect, it, vi, afterEach } from 'vitest'
import { mkdtempSync, rmSync, existsSync, writeFileSync } from 'fs'
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

  it('generatePlate persist + edit + promptOverride + multi-ref', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-plate-p-'))
    const out = join(dir, 'plate.png')
    const ref1 = join(dir, 'r1.png')
    const ref2 = join(dir, 'r2.png')
    writeFileSync(ref1, 'r1')
    writeFileSync(ref2, 'r2')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('PLATE').toString('base64'),
      sizeUsed: '1792x1024',
      aspectUsed: '16:9'
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('EDIT').toString('base64'),
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
      hardRules: 'NO logo',
      artStyle: 'anime',
      refGalleryJson: JSON.stringify([
        { path: ref1, kind: 'sheet', label: 'a' },
        { path: ref2, kind: 'sheet', label: 'b' }
      ]),
      refImagePath: ref1
    }))
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage, chat: vi.fn() },
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
    registerScenesPlate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const persisted = (await invokeRegistered(h as never, 'scenes:generatePlate', {
      sceneId: 'sc1',
      variant: 'establishing',
      persist: true,
      artStyle: 'photo_cinematic',
      promptOverride: '  custom plate prompt  ',
      referenceImagePath: ref1,
      useIdentityEdit: false
    })) as { draft: boolean }
    expect(persisted.draft).toBe(false)
    expect(generateImage).toHaveBeenCalled()

    // edit path with identity
    await invokeRegistered(h as never, 'scenes:generatePlate', {
      sceneId: 'sc1',
      variant: 'establishing',
      persist: false,
      useIdentityEdit: true,
      referenceImagePath: ref1
    })
    expect(editImage).toHaveBeenCalled()
  })

  it('commitPlate promotes draft', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-plate-c-'))
    const draft = join(dir, 'draft.png')
    writeFileSync(draft, 'x')
    const lib = join(dir, 'lib.png')
    writeFileSync(lib, 'lib')
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'sc1',
      title: 'Pier',
      description: 'd',
      refGalleryJson: null,
      refImagePath: null,
      artStyle: null
    }))
    const promoteTmpSceneImage = vi.fn(() => lib)
    const ctx = makeHandlerContext({
      scenes: () => ({ get, update }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            sceneImagePath: () => lib,
            promoteTmpSceneImage
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerScenesPlate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:commitPlate', {
      sceneId: 'sc1',
      path: draft,
      variant: 'establishing',
      label: 'Establishing'
    })) as { path: string }
    expect(promoteTmpSceneImage).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
    expect(r.path).toBeTruthy()

    await expect(
      invokeRegistered(h as never, 'scenes:commitPlate', {
        sceneId: 'sc1',
        path: join(dir, 'missing.png')
      })
    ).rejects.toMatchObject({ message: 'errors.draftNotFound' })
  })
})
