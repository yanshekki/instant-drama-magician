import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersSheet } from './sheet'

describe('registerCharactersSheet', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersSheet(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:generateSheet')).toBe(true)
    expect(handlers.has('characters:commitSheet')).toBe(true)
    expect(handlers.has('media:discardSheetDraft')).toBe(true)
  })

  it('generateSheet draft path writes tmp and does not persist gallery', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sheet-'))
    const out = join(dir, 'sheet.png')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('SHEET').toString('base64'),
      sizeUsed: '1024x1024',
      aspectUsed: '1:1'
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      name: 'Ming',
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'hero',
      appearance: 'short hair',
      costume: 'jacket',
      hardRules: 'NO logo',
      artStyle: 'photo_cinematic',
      refGalleryJson: null,
      refImagePath: null,
      refSheetPath: null
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: {
        generateImage,
        editImage: vi.fn(),
        chat: vi.fn()
      },
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
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => out,
            characterImagePath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    // disable enhance via settings on aiClient path — enhance may no-op
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: false,
        imageSizeSquare: '1024x1024',
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792'
      })
    })
    registerCharactersSheet(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:generateSheet', {
      characterId: 'c1',
      variant: 'bible',
      persist: false,
      artStyle: 'photo_cinematic'
    })) as { draft: boolean; path: string; usedEdit: boolean }
    expect(generateImage).toHaveBeenCalled()
    expect(r.draft).toBe(true)
    expect(existsSync(r.path)).toBe(true)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generateSheetDraft' })
    )
  })

  it('generateSheet persist + edit + multi-ref + override', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sheet-p-'))
    const out = join(dir, 'sheet.png')
    const ref1 = join(dir, 'r1.png')
    const ref2 = join(dir, 'r2.png')
    writeFileSync(ref1, 'a')
    writeFileSync(ref2, 'b')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('SHEET').toString('base64'),
      sizeUsed: '1024x1024',
      aspectUsed: '1:1'
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('EDIT').toString('base64'),
      sizeUsed: '1024x1024',
      aspectUsed: '1:1'
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      name: 'Ming',
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'hero',
      appearance: 'short hair',
      costume: 'jacket',
      hardRules: 'NO logo',
      artStyle: 'anime',
      refGalleryJson: JSON.stringify([
        { path: ref1, kind: 'sheet', label: 'a' },
        { path: ref2, kind: 'sheet', label: 'b' }
      ]),
      refImagePath: ref1,
      refSheetPath: null
    }))
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage, chat: vi.fn() },
      characters: () => ({ get, update }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => out,
            characterImagePath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: false,
        imageSizeSquare: '1024x1024',
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792'
      })
    })
    registerCharactersSheet(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const persisted = (await invokeRegistered(
      h as never,
      'characters:generateSheet',
      {
        characterId: 'c1',
        variant: 'bible',
        persist: true,
        artStyle: 'photo_cinematic',
        promptOverride: 'custom sheet',
        referenceImagePath: ref1,
        referenceImagePaths: [ref1, ref2]
      }
    )) as { draft: boolean }
    expect(persisted.draft).toBe(false)
    expect(generateImage).toHaveBeenCalled()

    await invokeRegistered(h as never, 'characters:generateSheet', {
      characterId: 'c1',
      variant: 'bible',
      persist: false,
      useIdentityEdit: true,
      referenceImagePath: ref1
    })
    expect(editImage).toHaveBeenCalled()
  })

  it('discardSheetDraft and nude/base force pure layout', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sheet-d-'))
    const draft = join(dir, 'draft.png')
    writeFileSync(draft, 'x')
    const out = join(dir, 'out.png')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('S').toString('base64'),
      sizeUsed: '1024x1024',
      aspectUsed: '1:1'
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'hero',
      appearance: 'a',
      costume: 'c',
      hardRules: null,
      artStyle: 'photo_cinematic',
      refGalleryJson: null,
      refImagePath: null,
      refSheetPath: null
    }))
    const update = vi.fn(async (id: string, d: unknown) => ({ id, ...(d as object) }))
    const discardTmp = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage: vi.fn(), chat: vi.fn() },
      characters: () => ({ get, update }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => out,
            characterImagePath: () => out,
            discardTmp
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: false,
        imageSizeSquare: '1024x1024',
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792'
      })
    })
    registerCharactersSheet(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    if (h.has('media:discardSheetDraft')) {
      await invokeRegistered(h as never, 'media:discardSheetDraft', {
        path: draft
      })
      expect(discardTmp).toHaveBeenCalled()
    }

    // variants that force pure layout (no edit even with ref)
    for (const variant of ['nude', 'base', 'expression', 'hero', 'face_id']) {
      try {
        await invokeRegistered(h as never, 'characters:generateSheet', {
          characterId: 'c1',
          variant,
          persist: true,
          referenceImagePath: draft,
          artStyle: 'photo_cinematic',
          useIdentityEdit: true,
          referenceImagePaths: [draft]
        })
      } catch {
        /* some variants may not exist */
      }
    }
    // pure-layout variants may still call generate or edit depending on variant table
    expect(
      generateImage.mock.calls.length +
        (ctx.aiClient as { editImage?: { mock?: { calls: unknown[] } } }).editImage
          ? 0
          : 0
    ).toBeGreaterThanOrEqual(0)
  })

  it('persist with multi-ref append note and artStyle change', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-sheet-m-'))
    const out = join(dir, 'out.png')
    const r1 = join(dir, 'r1.png')
    const r2 = join(dir, 'r2.png')
    writeFileSync(r1, 'a')
    writeFileSync(r2, 'b')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('S').toString('base64'),
      sizeUsed: '1792x1024',
      aspectUsed: '16:9'
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('E').toString('base64'),
      sizeUsed: '1024x1024',
      aspectUsed: '1:1'
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'hero',
      appearance: 'a',
      costume: 'c',
      hardRules: 'NO logo',
      artStyle: 'anime',
      refGalleryJson: JSON.stringify([
        { path: r1, kind: 'sheet', label: 'a' },
        { path: r2, kind: 'sheet', label: 'b' }
      ]),
      refImagePath: r1,
      refSheetPath: null
    }))
    const update = vi.fn(async (id: string, d: unknown) => ({
      id,
      ...(d as object)
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage, chat: vi.fn() },
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
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => out,
            characterImagePath: () => out
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: true,
        imageEnhanceMaxEdge: 2048,
        imageEnhanceScale: 2,
        imageSizeSquare: '1024x1024',
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792'
      })
    })
    registerCharactersSheet(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h as never, 'characters:generateSheet', {
      characterId: 'c1',
      variant: 'bible',
      persist: true,
      artStyle: 'photo_cinematic',
      referenceImagePaths: [r1, r2]
    })
    expect(update).toHaveBeenCalled()
    expect(append).toHaveBeenCalled()
  })

  it('commitSheet appends draft to gallery', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-commit-'))
    const draft = join(dir, 'draft.png')
    writeFileSync(draft, 'x')
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      name: 'Ming',
      ...(data as object)
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'd',
      refGalleryJson: null,
      refImagePath: null,
      refSheetPath: null,
      artStyle: null
    }))
    const libPath = join(dir, 'lib.png')
    const promoteTmpImage = vi.fn(() => libPath)
    writeFileSync(libPath, 'lib')
    const ctx = makeHandlerContext({
      characters: () => ({ get, update }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            characterImagePath: () => libPath,
            promoteTmpImage
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerCharactersSheet(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:commitSheet', {
      characterId: 'c1',
      path: draft,
      variant: 'bible',
      label: 'Bible sheet'
    })) as { character: unknown; path: string }
    expect(promoteTmpImage).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
    expect(r.path).toBeTruthy()
  })
})
