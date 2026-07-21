import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerStoriesHandlers } from './stories'

const META_JSON = JSON.stringify({
  styleNote: 'Neon rain-soaked cyber alley, wet asphalt reflections.',
  hardRules: '【禁止】水印、字幕、UI 邊框'
})

const BEATS_JSON = JSON.stringify([
  {
    characterName: 'Ming',
    sceneTitle: 'Rooftop',
    propName: 'Umbrella',
    dialogue: 'Wait for me.',
    scriptText: 'Ming runs through the rain.',
    durationSeconds: 6
  },
  {
    characterNames: ['Ming'],
    sceneNumber: 1,
    dialogue: 'Go!',
    durationSeconds: 10
  }
])

describe('registerStoriesHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers domain channels', () => {
    const ctx = makeHandlerContext()
    registerStoriesHandlers(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('stories:list')).toBe(true)
    expect(handlers.has('stories:get')).toBe(true)
    expect(handlers.has('stories:create')).toBe(true)
    expect(handlers.has('stories:update')).toBe(true)
    expect(handlers.has('stories:generateCover')).toBe(true)
    expect(handlers.has('stories:commitCover')).toBe(true)
    expect(handlers.has('stories:seedDemo')).toBe(true)
    expect(handlers.has('stories:aiFillMeta')).toBe(true)
    expect(handlers.has('stories:aiFillScript')).toBe(true)
  })

  it('invokes list/get/create/update/delete via service', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 's1', title: 'A' }]),
      get: vi.fn(async (id: string) => ({ id, title: 'A' })),
      create: vi.fn(async (input: unknown) => ({ id: 's2', ...(input as object) })),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id }))
    }
    const ctx = makeHandlerContext({
      stories: () => svc as never
    })
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(invokeRegistered(h as never, 'stories:list')).resolves.toEqual([
      { id: 's1', title: 'A' }
    ])
    await expect(
      invokeRegistered(h as never, 'stories:get', 's1')
    ).resolves.toMatchObject({ id: 's1' })
    await invokeRegistered(h as never, 'stories:create', {
      title: 'New',
      description: 'd'
    })
    expect(svc.create).toHaveBeenCalled()
    await invokeRegistered(h as never, 'stories:update', 's1', {
      title: 'Renamed',
      styleNote: 'neon'
    })
    expect(svc.update).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ title: 'Renamed' })
    )
    await invokeRegistered(h as never, 'stories:delete', 's1')
    expect(svc.delete).toHaveBeenCalledWith('s1')
  })

  it('generateCover pure generate (zh-HK) and commitCover', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-story-'))
    const out = join(dir, 'cover.png')
    const draft = join(dir, 'draft.png')
    writeFileSync(draft, 'png')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('COVER').toString('base64')
    }))
    const get = vi.fn(async () => ({
      id: 's1',
      title: '夜雨',
      styleNote: 'neon rain',
      artStyle: null,
      coverPath: null,
      refGalleryJson: null
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const promote = vi.fn(() => out)
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage: vi.fn(), chat: vi.fn() },
      stories: () => ({ get, update, list: vi.fn(), create: vi.fn(), delete: vi.fn() }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => draft,
            promoteTmpStoryImage: promote
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ imageSizeWide: '1792x1024' })
    })
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const gen = (await invokeRegistered(h as never, 'stories:generateCover', {
      storyId: 's1',
      idea: 'umbrella duel',
      locale: 'zh-HK'
    })) as { path: string; draft: boolean; usedEdit: boolean }
    expect(generateImage).toHaveBeenCalled()
    expect(gen.draft).toBe(true)
    expect(gen.usedEdit).toBe(false)
    expect(gen.path).toBe(draft)

    const committed = (await invokeRegistered(h as never, 'stories:commitCover', {
      storyId: 's1',
      path: draft,
      label: 'Cover A'
    })) as { path: string; story: { coverPath?: string } }
    expect(promote).toHaveBeenCalled()
    expect(committed.path).toBe(out)
    expect(update).toHaveBeenCalled()
  })

  it('generateCover en locale with identity edit + multi refs + promptOverride', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-story2-'))
    const ref1 = join(dir, 'r1.png')
    const ref2 = join(dir, 'r2.png')
    const draft = join(dir, 'd.png')
    writeFileSync(ref1, 'a')
    writeFileSync(ref2, 'b')
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('EDIT').toString('base64')
    }))
    const get = vi.fn(async () => ({
      id: 's1',
      title: 'Storm',
      styleNote: null,
      artStyle: 'anime',
      coverPath: null,
      refGalleryJson: null
    }))
    const ctx = makeHandlerContext({
      aiClient: {
        generateImage: vi.fn(),
        editImage,
        chat: vi.fn()
      },
      stories: () =>
        ({
          get,
          update: vi.fn(),
          list: vi.fn(),
          create: vi.fn(),
          delete: vi.fn()
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => draft
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ imageSizeWide: '1024x1024' })
    })
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const r = (await invokeRegistered(h as never, 'stories:generateCover', {
      storyId: 's1',
      locale: 'en',
      useIdentityEdit: true,
      referenceImagePath: ref1,
      referenceImagePaths: [ref1, ref2],
      promptOverride: 'CUSTOM POSTER PROMPT ONLY'
    })) as { usedEdit: boolean }
    expect(editImage).toHaveBeenCalled()
    expect(r.usedEdit).toBe(true)

    // commitCover rejects missing draft
    await expect(
      invokeRegistered(h as never, 'stories:commitCover', {
        storyId: 's1',
        path: '/no/such/draft.png'
      })
    ).rejects.toMatchObject({ message: 'errors.draftNotFound' })
  })

  it('seedDemo runs DemoSeedService and marks firstRunSeen', async () => {
    const save = vi.fn((p: unknown) => p)
    let n = 0
    const id = () => `id-${++n}`
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: id(),
      ...data
    }))
    const createMany = vi.fn(async () => ({ count: 1 }))
    const prisma = {
      story: { create },
      character: { create },
      scene: { create },
      prop: { create },
      action: { create },
      costume: { create },
      timelineEntry: { create, createMany },
      storyCharacter: { create, createMany },
      storyScene: { create, createMany },
      storyProp: { create, createMany },
      storyAction: { create, createMany },
      storyCostume: { create, createMany }
    }
    const ctx = makeHandlerContext({
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => prisma as never
      } as never,
      settingsStore: {
        load: vi.fn(() => ({})),
        save,
        lastLoadMigrated: false
      } as never
    })
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const result = (await invokeRegistered(
      h as never,
      'stories:seedDemo',
      'en'
    )) as { storyId: string; title: string }
    expect(result.storyId).toBeTruthy()
    expect(result.title).toMatch(/Demo/i)
    expect(save).toHaveBeenCalledWith({ firstRunSeen: true })
    // default locale path
    await invokeRegistered(h as never, 'stories:seedDemo')
  })

  it('aiFillMeta from title/idea and storyId context; validates empty', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: META_JSON } }]
    }))
    const append = vi.fn()
    const storyFindUnique = vi.fn(async () => ({
      id: 's1',
      title: 'Night Rain',
      styleNote: 'wet',
      hardRules: null,
      storyCharacters: [
        {
          character: {
            name: 'Ming',
            description: 'courier',
            appearance: 'short hair'
          }
        }
      ],
      storyScenes: [
        {
          sceneNumber: 1,
          scene: { title: 'Alley', description: 'wet street' }
        }
      ],
      storyProps: [{ prop: { name: 'Umbrella' } }]
    }))
    const get = vi.fn(async () => ({
      id: 's1',
      title: 'Night Rain',
      styleNote: 'old style',
      hardRules: 'old rules'
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() },
      stories: () =>
        ({
          get,
          list: vi.fn(),
          create: vi.fn(),
          update: vi.fn(),
          delete: vi.fn()
        }) as never,
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
        getPrisma: () =>
          ({
            story: { findUnique: storyFindUnique }
          }) as never
      } as never
    })
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'stories:aiFillMeta', {})
    ).rejects.toMatchObject({ message: 'errors.ideaOrDraftRequired' })

    const r = (await invokeRegistered(h as never, 'stories:aiFillMeta', {
      storyId: 's1',
      idea: 'chase in rain',
      locale: 'en'
    })) as { styleNote: string; hardRules: string }
    expect(r.styleNote).toContain('Neon')
    expect(chat).toHaveBeenCalled()
    expect(storyFindUnique).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillMeta' })
    )

    // without storyId — title only
    await invokeRegistered(h as never, 'stories:aiFillMeta', {
      title: 'Solo title',
      locale: 'zh-HK'
    })
  })

  it('aiFillScript replace and append modes', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: BEATS_JSON } }]
    }))
    const append = vi.fn()
    const deleteMany = vi.fn(async () => ({ count: 2 }))
    const aggregate = vi.fn(async () => ({
      _max: { order: 3, endTime: 18 }
    }))
    const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
      id: `te-${data.order}`,
      dialogue: data.dialogue,
      beatContentJson: data.beatContentJson ?? null,
      characterId: data.characterId ?? null,
      sceneId: data.sceneId ?? null,
      propId: data.propId ?? null,
      order: data.order
    }))
    const get = vi.fn(async () => ({
      id: 's1',
      title: 'Night Rain',
      styleNote: 'neon',
      characters: [
        {
          id: 'c1',
          name: 'Ming',
          description: 'courier',
          appearance: 'short',
          costume: 'jacket',
          personality: 'stubborn'
        }
      ],
      scenes: [
        {
          id: 'sc1',
          sceneNumber: 1,
          title: 'Rooftop',
          description: 'rain',
          script: null
        }
      ],
      props: [{ id: 'p1', name: 'Umbrella', description: 'black' }]
    }))
    const makeCtx = () =>
      makeHandlerContext({
        aiClient: { chat, generateImage: vi.fn() },
        stories: () =>
          ({
            get,
            list: vi.fn(),
            create: vi.fn(),
            update: vi.fn(),
            delete: vi.fn()
          }) as never,
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
          getPrisma: () =>
            ({
              timelineEntry: { deleteMany, aggregate, create }
            }) as never
        } as never
      })

    const ctx = makeCtx()
    registerStoriesHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'stories:aiFillScript', { storyId: '' })
    ).rejects.toMatchObject({ message: 'errors.storyIdRequired' })

    const replaced = (await invokeRegistered(h as never, 'stories:aiFillScript', {
      storyId: 's1',
      idea: 'chase',
      locale: 'en',
      replace: true
    })) as { beats: unknown[] }
    expect(deleteMany).toHaveBeenCalled()
    expect(create).toHaveBeenCalled()
    expect(replaced.beats.length).toBeGreaterThan(0)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillScript' })
    )

    deleteMany.mockClear()
    aggregate.mockClear()
    create.mockClear()
    const appended = (await invokeRegistered(h as never, 'stories:aiFillScript', {
      storyId: 's1',
      replace: false,
      locale: 'zh-HK'
    })) as { beats: unknown[] }
    expect(deleteMany).not.toHaveBeenCalled()
    expect(aggregate).toHaveBeenCalled()
    expect(appended.beats.length).toBeGreaterThan(0)
  })
})
