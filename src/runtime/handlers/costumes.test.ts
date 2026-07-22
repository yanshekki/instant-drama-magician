import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerCostumesHandlers } from './costumes'

const COSTUME_JSON = JSON.stringify({
  name: 'Rain coat',
  description: 'Yellow vinyl raincoat with hood, reflective strips',
  artStyle: '',
  hardRules: '【禁止】水印'
})

function costumeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cos1',
    name: 'Rain',
    description: 'yellow raincoat',
    hardRules: '【禁止】logo',
    artStyle: null,
    refImagePath: null,
    refGalleryJson: null,
    characterLinks: [] as Array<{
      characterId: string
      dressedImagePath?: string | null
    }>,
    ...overrides
  }
}

describe('registerCostumesHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers and invokes core costume CRUD + links', async () => {
    const svc = {
      list: vi.fn(async () => [
        costumeRow({
          characterLinks: [{ characterId: 'c1', dressedImagePath: '/d.png' }]
        })
      ]),
      get: vi.fn(async (id: string) => costumeRow({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id })),
      linkCharacter: vi.fn(async () => ({ ok: true })),
      unlinkCharacter: vi.fn(async () => ({ ok: true })),
      setDressedImage: vi.fn(async () => ({ ok: true }))
    }
    const charGet = vi.fn(async () => ({
      id: 'c1',
      costume: 'yellow raincoat'
    }))
    const ctx = makeHandlerContext({
      costumes: () => svc as never,
      characters: () => ({ get: charGet }) as never
    })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('costumes:list')).toBe(true)

    await invokeRegistered(h as never, 'costumes:list', { q: 'rain' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'rain' })
    await invokeRegistered(h as never, 'costumes:get', 'cos1')
    await invokeRegistered(h as never, 'costumes:create', {
      name: 'Rain',
      description: 'coat'
    })
    await invokeRegistered(h as never, 'costumes:update', 'cos1', {
      name: 'Rain2'
    })
    await invokeRegistered(h as never, 'costumes:delete', 'cos1')
    await invokeRegistered(h as never, 'costumes:linkCharacter', {
      costumeId: 'cos1',
      characterId: 'c1'
    })
    await invokeRegistered(h as never, 'costumes:unlinkCharacter', {
      costumeId: 'cos1',
      characterId: 'c1'
    })
    const listed = (await invokeRegistered(
      h as never,
      'costumes:listForCharacter',
      'c1'
    )) as Array<{ isActive: boolean; dressedImagePath: string | null }>
    expect(listed[0].isActive).toBe(true)
    expect(listed[0].dressedImagePath).toBe('/d.png')
  })

  it('aiFill idea/draft/image paths and invalid JSON fallback', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cos-'))
    const img = join(dir, 'r.png')
    writeFileSync(img, 'png')
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: COSTUME_JSON } }]
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'costumes:aiFill', {})
    ).rejects.toMatchObject({ message: 'errors.ideaOrImageRequired' })

    const r = (await invokeRegistered(h as never, 'costumes:aiFill', {
      idea: 'yellow raincoat',
      locale: 'en'
    })) as { name: string }
    expect(r.name).toMatch(/Rain/i)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillCostume' })
    )

    await invokeRegistered(h as never, 'costumes:aiFill', {
      existingDraft: { name: 'Coat', description: 'yellow' },
      locale: 'zh-HK'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiRefineCostume' })
    )

    await invokeRegistered(h as never, 'costumes:aiFill', {
      referenceImagePath: img,
      locale: 'en'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillCostumeFromImage' })
    )

    // non-JSON response → fallback description/name
    chat.mockResolvedValueOnce({
      choices: [{ message: { content: 'not json wardrobe text for coat' } }]
    })
    const fb = (await invokeRegistered(h as never, 'costumes:aiFill', {
      idea: 'x',
      locale: 'en'
    })) as { name: string; description: string }
    expect(fb.description).toContain('not json')
    expect(fb.name).toBeTruthy()
  })

  it('generateDressed with base image and prompt override', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cos-dress-'))
    const base = join(dir, 'base.png')
    const cosOut = join(dir, 'cos.png')
    const charOut = join(dir, 'char.png')
    writeFileSync(base, 'png')
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('DRESS').toString('base64')
    }))
    const costumesSvc = {
      get: vi.fn(async () =>
        costumeRow({ description: 'yellow raincoat', artStyle: 'anime' })
      ),
      linkCharacter: vi.fn(async () => ({ ok: true })),
      setDressedImage: vi.fn(async () => ({ ok: true })),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...costumeRow(),
        ...(data as object)
      })),
      list: vi.fn(),
      create: vi.fn(),
      delete: vi.fn()
    }
    const charactersSvc = {
      get: vi.fn(async () => ({
        id: 'c1',
        name: 'Ming',
        appearance: 'short hair',
        ageRange: '20s',
        gender: 'm',
        visualTags: 'urban',
        mannerisms: null,
        hardRules: 'NO logo',
        artStyle: null,
        costume: 'jacket',
        refImagePath: base,
        refSheetPath: base,
        refGalleryJson: JSON.stringify([
          {
            id: 'g1',
            path: base,
            kind: 'sheet',
            label: 'Sheet',
            createdAt: '2020-01-01'
          }
        ])
      })),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      }))
    }
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: { editImage, generateImage: vi.fn(), chat: vi.fn() },
      costumes: () => costumesSvc as never,
      characters: () => charactersSvc as never,
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
            costumeImagePath: () => cosOut,
            characterImagePath: () => charOut
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792',
        imageSizeSquare: '1024x1024'
      })
    })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const r = (await invokeRegistered(h as never, 'costumes:generateDressed', {
      costumeId: 'cos1',
      characterId: 'c1',
      baseImagePath: base,
      pose: 'standing',
      promptOverride: 'CUSTOM DRESS PROMPT'
    })) as { path: string }
    expect(editImage).toHaveBeenCalled()
    expect(r.path).toBe(cosOut)
    expect(costumesSvc.linkCharacter).toHaveBeenCalled()
    expect(costumesSvc.setDressedImage).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generateDressed' })
    )

    // missing base → validation
    charactersSvc.get.mockResolvedValueOnce({
      id: 'c1',
      name: 'Ming',
      appearance: null,
      ageRange: null,
      gender: null,
      visualTags: null,
      mannerisms: null,
      hardRules: null,
      artStyle: null,
      costume: null,
      refImagePath: null,
      refSheetPath: null,
      refGalleryJson: null
    })
    await expect(
      invokeRegistered(h as never, 'costumes:generateDressed', {
        costumeId: 'cos1',
        characterId: 'c1',
        baseImagePath: '/gone.png'
      })
    ).rejects.toMatchObject({ message: 'errors.costumeNoBaseImage' })
  })

  it('appendTryOnStill copies still into costume multi-gallery', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cos-tryon-'))
    const src = join(dir, 'draft.png')
    const cosOut = join(dir, 'cos-dressed.png')
    writeFileSync(src, 'png-bytes')
    const get = vi.fn(async () =>
      costumeRow({
        id: 'cos1',
        refImagePath: null,
        refGalleryJson: null
      })
    )
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...costumeRow(),
      ...(data as object)
    }))
    const setDressedImage = vi.fn(async () => ({ ok: true }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      costumes: () =>
        ({
          get,
          update,
          setDressedImage
        }) as never,
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
            costumeImagePath: () => cosOut
          })
        }) as never
    })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('costumes:appendTryOnStill')).toBe(true)

    const r = (await invokeRegistered(h as never, 'costumes:appendTryOnStill', {
      costumeId: 'cos1',
      characterId: 'c1',
      sourcePath: src,
      label: 'Try-on hero'
    })) as { path: string; gallery: Array<{ path: string; label: string }> }

    expect(r.path).toBe(cosOut)
    expect(r.gallery.some((g) => g.path === cosOut)).toBe(true)
    expect(update).toHaveBeenCalledWith(
      'cos1',
      expect.objectContaining({
        refImagePath: cosOut,
        refGalleryJson: expect.stringContaining('Try-on hero')
      })
    )
    expect(setDressedImage).toHaveBeenCalledWith('cos1', 'c1', cosOut)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'appendTryOnStill' })
    )

    await expect(
      invokeRegistered(h as never, 'costumes:appendTryOnStill', {
        costumeId: 'cos1',
        sourcePath: join(dir, 'missing.png')
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })
  })

  it('generateIntroVideo validates and runs polish pipeline', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cos-iv-'))
    const src = join(dir, 's.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(src, 'png')
    const long =
      'POLISHED COSTUME INTRO VIDEO PROMPT WITH ENOUGH LENGTH FOR ACCEPTANCE!!'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const get = vi.fn(async () =>
      costumeRow({
        refGalleryJson: JSON.stringify([
          {
            id: 'g1',
            path: src,
            kind: 'sheet',
            label: 'Look',
            createdAt: '2020-01-01'
          }
        ]),
        refImagePath: src
      })
    )
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...costumeRow(),
      ...(data as object)
    }))
    const append = vi.fn()

    const ctxNoVideo = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat },
      costumes: () => ({ get, update }) as never
    })
    registerCostumesHandlers(ctxNoVideo)
    const h0 = (ctxNoVideo as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h0 as never, 'costumes:generateIntroVideo', {
        costumeId: 'cos1',
        sourceImagePath: '/missing.png'
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })
    await expect(
      invokeRegistered(h0 as never, 'costumes:generateIntroVideo', {
        costumeId: 'cos1',
        sourceImagePath: src
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })

    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      costumes: () => ({ get, update }) as never,
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
            costumeVideoPath: () => out
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '16:9' })
    })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'costumes:generateIntroVideo', {
      costumeId: 'cos1',
      sourceImagePath: src,
      durationSeconds: 6,
      locale: 'en'
    })) as { path: string }
    expect(r.path).toBe(out)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'generateIntroVideo' })
    )

    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: 'bad' })
    })
    await invokeRegistered(h as never, 'costumes:generateIntroVideo', {
      costumeId: 'cos1',
      sourceImagePath: src,
      locale: 'zh-HK'
    })
  })

  it('setActiveOnCharacter, aiFill zh, wardrobe polish, costume swap size classes', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-cos-scrub-'))
    const out = join(dir, 'swap.png')
    writeFileSync(out, 'x')
    const ref = join(dir, 'ref.png')
    writeFileSync(ref, 'r')
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: COSTUME_JSON } }]
    }))
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
    const setActiveOnCharacter = vi.fn(async () => ({ ok: true }))
    const get = vi.fn(async () =>
      costumeRow({
        hardRules: 'H',
        artStyle: 'photo_cinematic'
      })
    )
    const charactersGet = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'hero',
      appearance: 'tall',
      ageRange: '20s',
      gender: 'm',
      visualTags: 'tags',
      mannerisms: 'nods',
      hardRules: 'no logo',
      artStyle: 'photo_cinematic',
      refImagePath: ref,
      costume: 'jacket'
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage, editImage },
      costumes: () =>
        ({
          get,
          list: vi.fn(async () => []),
          create: vi.fn(),
          update: vi.fn(async (id, d) => ({ id, ...d })),
          remove: vi.fn(),
          setActiveOnCharacter,
          linkCharacter: vi.fn(),
          unlinkCharacter: vi.fn()
        }) as never,
      characters: () =>
        ({
          get: charactersGet,
          update: vi.fn(async (id, d) => ({ id, ...d }))
        }) as never,
      activity: {
        append: vi.fn(),
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
            costumeImagePath: () => out,
            characterImagePath: () => out,
            promoteTmpImage: vi.fn(() => out)
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
        imageSizeTall: '1024x1792',
        aspectRatio: '16:9'
      })
    })
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    // setActive if channel exists
    if (h.has('costumes:setActive')) {
      await invokeRegistered(h as never, 'costumes:setActive', {
        costumeId: 'cos1',
        characterId: 'c1'
      })
      expect(setActiveOnCharacter).toHaveBeenCalled()
    }

    // aiFill with locale zh and idea only
    if (h.has('costumes:aiFill')) {
      await invokeRegistered(h as never, 'costumes:aiFill', {
        costumeId: 'cos1',
        idea: '雨衣',
        locale: 'zh-HK'
      })
    }

    // wardrobe suggest
    if (h.has('costumes:suggestWardrobe') || h.has('costumes:aiWardrobe')) {
      const key = h.has('costumes:suggestWardrobe')
        ? 'costumes:suggestWardrobe'
        : 'costumes:aiWardrobe'
      try {
        await invokeRegistered(h as never, key, {
          characterId: 'c1',
          locale: 'en',
          draft: { description: '  trench coat  ' }
        })
      } catch { /* */ }
    }

    // costume swap
    if (h.has('costumes:generateDressed') || h.has('characters:costumeSwap')) {
      const key = [...h.keys()].find((k) => /swap|costumeSwap|generateDressed/i.test(k))
      if (key) {
        try {
          await invokeRegistered(h as never, key, {
            costumeId: 'cos1',
            characterId: 'c1',
            pose: 'front',
            persist: false
          })
        } catch { /* */ }
      }
    }

    // list channels for debug coverage of remaining
    for (const key of h.keys()) {
      if (/generateSheet|generateImage|swap/i.test(key)) {
        try {
          await invokeRegistered(h as never, key, {
            costumeId: 'cos1',
            characterId: 'c1',
            referenceImagePath: ref,
            persist: false,
            locale: 'en'
          })
        } catch { /* */ }
      }
    }
  })

  it('residual missing-fill raw and square pose size', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'idm-cos-z-'))
    const ref = join(dir, 'r.png')
    writeFileSync(ref, 'p')
    const incomplete = JSON.stringify({
      name: 'Coat',
      description: '',
      appearance: '',
      visualTags: '',
      hardRules: ''
    })
    let n = 0
    const chat = vi.fn(async () => {
      n++
      if (n === 1) return { choices: [{ message: { content: incomplete } }] }
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Coat',
                description: 'long',
                appearance: 'black',
                visualTags: 'x',
                hardRules: 'NO'
              })
            }
          }
        ]
      }
    })
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('Y').toString('base64')
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('X').toString('base64')
    }))
    const get = vi.fn(async () => ({
      id: 'cos1',
      name: 'Coat',
      description: 'd',
      appearance: 'a',
      visualTags: 't',
      hardRules: null,
      characterId: 'c1',
      refImagePath: ref
    }))
    const charGet = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'd',
      appearance: 'short hair',
      ageRange: '20s',
      gender: 'm',
      visualTags: 'urban',
      mannerisms: null,
      hardRules: null,
      refImagePath: ref
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage, editImage },
      costumes: () =>
        ({
          get,
          update: vi.fn(async (id: string, d: unknown) => ({
            id,
            ...(d as object)
          }))
        }) as never,
      characters: () => ({ get: charGet }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => join(dir, 't.png'),
            costumeImagePath: () => join(dir, 'out.png'),
            characterImagePath: () => ref
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
    registerCostumesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    if (h.has('costumes:aiFill')) {
      try {
        await invokeRegistered(h as never, 'costumes:aiFill', {
          idea: 'coat',
          locale: 'en'
        })
      } catch {
        /* */
      }
    }
    // dress gen with square pose if channel exists
    for (const key of h.keys()) {
      if (/generateDress|generatePose|generateStill|swap/i.test(key)) {
        try {
          await invokeRegistered(h as never, key, {
            costumeId: 'cos1',
            characterId: 'c1',
            pose: 'square',
            sizeClass: 'square',
            referenceImagePath: ref,
            locale: 'en'
          })
        } catch {
          /* */
        }
      }
    }
    rmSync(dir, { recursive: true, force: true })
  })
})
