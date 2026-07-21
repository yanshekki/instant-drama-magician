import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerPropsHandlers } from './props'

const PROP_PROFILE = JSON.stringify({
  name: 'Black umbrella',
  description: 'Compact travel umbrella with wood handle',
  material: 'nylon, wood',
  sizeNotes: 'closed 30cm',
  condition: 'slightly worn',
  visualTags: 'black, umbrella, rain',
  artStyle: '',
  hardRules: '【禁止】水印'
})

function propRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Umbrella',
    description: 'black compact',
    material: 'nylon',
    sizeNotes: '30cm',
    condition: 'worn',
    visualTags: 'black, rain',
    hardRules: '【禁止】logo',
    artStyle: null,
    refImagePath: null,
    refGalleryJson: null,
    seedPrompt: null,
    ...overrides
  }
}

describe('registerPropsHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers and invokes CRUD list variants', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'p1' }]),
      listForStory: vi.fn(async () => [{ id: 'ps' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id }))
    }
    const ctx = makeHandlerContext({ props: () => svc as never })
    registerPropsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('props:list')).toBe(true)

    await invokeRegistered(h as never, 'props:list')
    expect(svc.list).toHaveBeenCalledWith({ q: undefined })
    await invokeRegistered(h as never, 'props:list', 'story1')
    expect(svc.listForStory).toHaveBeenCalledWith('story1')
    await invokeRegistered(h as never, 'props:list', {
      forStory: true,
      storyId: 's2'
    })
    expect(svc.listForStory).toHaveBeenCalledWith('s2')
    await invokeRegistered(h as never, 'props:list', { q: 'umbrella' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'umbrella' })

    await invokeRegistered(h as never, 'props:create', {
      name: 'U',
      description: 'd'
    })
    await invokeRegistered(h as never, 'props:update', 'p1', { name: 'V' })
    await invokeRegistered(h as never, 'props:delete', 'p1')
    expect(svc.delete).toHaveBeenCalledWith('p1')
  })

  it('aiFill validates and fills from idea, draft, image, story context', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-prop-'))
    const img = join(dir, 'ref.png')
    writeFileSync(img, 'png')
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: PROP_PROFILE } }]
    }))
    const append = vi.fn()
    const findUnique = vi.fn(async () => ({
      id: 's1',
      title: 'Night Rain',
      styleNote: 'neon wet'
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => ({ story: { findUnique } }) as never
      } as never
    })
    registerPropsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'props:aiFill', {})
    ).rejects.toMatchObject({ message: 'errors.ideaOrImageRequired' })

    const filled = (await invokeRegistered(h as never, 'props:aiFill', {
      idea: 'black umbrella',
      locale: 'en'
    })) as { profile: { name: string } }
    expect(filled.profile.name).toMatch(/umbrella/i)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillProp' })
    )

    await invokeRegistered(h as never, 'props:aiFill', {
      existingDraft: { name: 'U', material: 'steel' },
      locale: 'zh-HK'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiRefineProp' })
    )

    // draft + storyId injects story context
    await invokeRegistered(h as never, 'props:aiFill', {
      storyId: 's1',
      existingDraft: { name: 'U', description: 'd' },
      locale: 'en'
    })
    expect(findUnique).toHaveBeenCalled()

    // image-only path (en + zh)
    await invokeRegistered(h as never, 'props:aiFill', {
      referenceImagePath: img,
      locale: 'en'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillPropFromImage' })
    )
    await invokeRegistered(h as never, 'props:aiFill', {
      referenceImagePath: img,
      locale: 'zh-HK'
    })
  })

  it('generatePlate draft and persist paths with edit/generate', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-prop-plate-'))
    const ref = join(dir, 'ref.png')
    const ref2 = join(dir, 'ref2.png')
    const out = join(dir, 'plate.png')
    writeFileSync(ref, 'a')
    writeFileSync(ref2, 'b')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('IMG').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('EDIT').toString('base64')
    }))
    const get = vi.fn(async () => propRow({ artStyle: 'cinematic' }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...propRow(),
      ...(data as object)
    }))
    const append = vi.fn()
    const media = {
      ensureLibraryDirs: vi.fn(),
      ensureTmpDir: vi.fn(),
      tmpImagePath: () => out,
      propImagePath: () => out
    }
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage, chat: vi.fn() },
      props: () => ({ get, update, list: vi.fn(), create: vi.fn(), delete: vi.fn() }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      generation: () => ({ getMediaStore: () => media }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageEnhance: false,
        imageEnhanceMaxEdge: 1600,
        imageEnhanceScale: 2
      })
    })
    registerPropsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const draft = (await invokeRegistered(h as never, 'props:generatePlate', {
      propId: 'p1',
      variant: 'hero'
    })) as { draft: boolean; path: string }
    expect(generateImage).toHaveBeenCalled()
    expect(draft.draft).toBe(true)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generatePropPlateDraft' })
    )

    const persisted = (await invokeRegistered(h as never, 'props:generatePlate', {
      propId: 'p1',
      variant: 'hero',
      persist: true,
      useIdentityEdit: true,
      referenceImagePath: ref,
      referenceImagePaths: [ref, ref2],
      artStyle: 'anime',
      promptOverride: 'CUSTOM PROP PLATE PROMPT'
    })) as { draft: boolean }
    expect(editImage).toHaveBeenCalled()
    expect(persisted.draft).toBe(false)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generatePropPlate' })
    )
  })

  it('generateIntroVideo validates and produces video', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-prop-iv-'))
    const src = join(dir, 's.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(src, 'png')
    const long =
      'POLISHED PROP INTRO VIDEO PROMPT WITH ENOUGH LENGTH FOR ACCEPTANCE RULES'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const get = vi.fn(async () =>
      propRow({
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
      })
    )
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...propRow(),
      ...(data as object)
    }))
    const append = vi.fn()
    const ctxNoVideo = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat },
      props: () => ({ get, update }) as never
    })
    registerPropsHandlers(ctxNoVideo)
    const h0 = (ctxNoVideo as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h0 as never, 'props:generateIntroVideo', {
        propId: 'p1',
        sourceImagePath: '/missing.png'
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })
    await expect(
      invokeRegistered(h0 as never, 'props:generateIntroVideo', {
        propId: 'p1',
        sourceImagePath: src
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })

    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      props: () => ({ get, update }) as never,
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
            propVideoPath: () => out
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '16:9' })
    })
    registerPropsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'props:generateIntroVideo', {
      propId: 'p1',
      sourceImagePath: src,
      durationSeconds: 6,
      locale: 'en'
    })) as { path: string }
    expect(generateVideo).toHaveBeenCalled()
    expect(r.path).toBe(out)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generateIntroVideo' })
    )

    // default duration + zh-HK locale
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '9:16' })
    })
    await invokeRegistered(h as never, 'props:generateIntroVideo', {
      propId: 'p1',
      sourceImagePath: src,
      locale: 'zh-HK'
    })
  })

  it('commitPlate promotes draft and rejects missing', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-prop-commit-'))
    const draft = join(dir, 'd.png')
    const finalPath = join(dir, 'final.png')
    writeFileSync(draft, 'png')
    const get = vi.fn(async () => propRow())
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...propRow(),
      ...(data as object)
    }))
    const promote = vi.fn(() => finalPath)
    const append = vi.fn()
    const ctx = makeHandlerContext({
      props: () => ({ get, update }) as never,
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
          getMediaStore: () => ({ promoteTmpPropImage: promote })
        }) as never
    })
    registerPropsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'props:commitPlate', {
        propId: 'p1',
        path: '/nope.png'
      })
    ).rejects.toMatchObject({ message: 'errors.draftNotFound' })

    const r = (await invokeRegistered(h as never, 'props:commitPlate', {
      propId: 'p1',
      path: draft,
      variant: 'hero',
      label: 'Hero plate'
    })) as { path: string }
    expect(promote).toHaveBeenCalled()
    expect(r.path).toBe(finalPath)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'commitPropPlate' })
    )
  })
})
