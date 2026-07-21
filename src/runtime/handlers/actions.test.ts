import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerActionsHandlers } from './actions'

const ACTION_PROFILE = JSON.stringify({
  name: 'Kick door',
  description: 'Explosive kick through wooden door',
  motionNotes: 'plant left, rotate hips, right heel strike',
  intention: 'force entry',
  cameraNotes: 'low angle, 24mm',
  visualTags: 'kick, door, action',
  artStyle: '',
  panelLayout: '4panel',
  hardRules: '【禁止】水印'
})

function actionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'a1',
    name: 'Kick',
    description: 'kick door open',
    motionNotes: 'heel strike',
    intention: 'enter',
    cameraNotes: 'low',
    visualTags: 'kick',
    hardRules: '【禁止】logo',
    artStyle: null,
    panelLayout: null,
    castRefsJson: null,
    refImagePath: null,
    refGalleryJson: null,
    seedPrompt: null,
    ...overrides
  }
}

describe('registerActionsHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers and invokes CRUD + link channels', async () => {
    const svc = {
      list: vi.fn(async () => [{ id: 'a1' }]),
      listForStory: vi.fn(async () => [{ id: 'as' }]),
      get: vi.fn(async (id: string) => ({ id })),
      create: vi.fn(async (input: unknown) => input),
      update: vi.fn(async (id: string, data: unknown) => ({
        id,
        ...(data as object)
      })),
      delete: vi.fn(async (id: string) => ({ id })),
      linkStory: vi.fn(async () => ({ ok: true })),
      unlinkStory: vi.fn(async () => ({ ok: true }))
    }
    const ctx = makeHandlerContext({ actions: () => svc as never })
    registerActionsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await invokeRegistered(h as never, 'actions:list', { q: 'kick' })
    expect(svc.list).toHaveBeenCalledWith({ q: 'kick' })
    await invokeRegistered(h as never, 'actions:list', 'story1')
    expect(svc.listForStory).toHaveBeenCalledWith('story1')
    await invokeRegistered(h as never, 'actions:list', {
      forStory: true,
      storyId: 's2'
    })
    expect(svc.listForStory).toHaveBeenCalledWith('s2')
    await invokeRegistered(h as never, 'actions:list')
    await invokeRegistered(h as never, 'actions:get', 'a1')
    await invokeRegistered(h as never, 'actions:create', {
      name: 'Kick',
      description: 'd'
    })
    await invokeRegistered(h as never, 'actions:update', 'a1', { name: 'K2' })
    await invokeRegistered(h as never, 'actions:delete', 'a1')
    await invokeRegistered(h as never, 'actions:linkStory', 's1', 'a1')
    await invokeRegistered(h as never, 'actions:unlinkStory', 's1', 'a1')
    expect(svc.linkStory).toHaveBeenCalledWith('s1', 'a1')
    expect(svc.unlinkStory).toHaveBeenCalledWith('s1', 'a1')
  })

  it('aiFill idea/draft/image/story paths', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-act-'))
    const img = join(dir, 'r.png')
    writeFileSync(img, 'png')
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: ACTION_PROFILE } }]
    }))
    const append = vi.fn()
    const findUnique = vi.fn(async () => ({
      id: 's1',
      title: 'Heist',
      styleNote: 'noir'
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
    registerActionsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'actions:aiFill', {})
    ).rejects.toMatchObject({ message: 'errors.ideaOrImageRequired' })

    await invokeRegistered(h as never, 'actions:aiFill', {
      idea: 'kick door',
      locale: 'en'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillAction' })
    )

    await invokeRegistered(h as never, 'actions:aiFill', {
      existingDraft: { name: 'Kick', motionNotes: 'x' },
      locale: 'zh-HK'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiRefineAction' })
    )

    await invokeRegistered(h as never, 'actions:aiFill', {
      storyId: 's1',
      existingDraft: { name: 'Kick', description: 'd' }
    })
    expect(findUnique).toHaveBeenCalled()

    await invokeRegistered(h as never, 'actions:aiFill', {
      referenceImagePath: img,
      locale: 'en'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiFillActionFromImage' })
    )
    await invokeRegistered(h as never, 'actions:aiFill', {
      referenceImagePath: img,
      locale: 'zh-HK'
    })
  })

  it('generatePlate draft + persist with edit', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-act-plate-'))
    const ref = join(dir, 'r.png')
    const ref2 = join(dir, 'r2.png')
    const out = join(dir, 'plate.png')
    writeFileSync(ref, 'a')
    writeFileSync(ref2, 'b')
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('IMG').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('EDIT').toString('base64')
    }))
    const get = vi.fn(async () => actionRow({ artStyle: 'cinematic' }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...actionRow(),
      ...(data as object)
    }))
    const append = vi.fn()
    const media = {
      ensureLibraryDirs: vi.fn(),
      ensureTmpDir: vi.fn(),
      tmpImagePath: () => out,
      actionImagePath: () => out
    }
    const ctx = makeHandlerContext({
      aiClient: { generateImage, editImage, chat: vi.fn() },
      actions: () =>
        ({ get, update, list: vi.fn(), create: vi.fn(), delete: vi.fn() }) as never,
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
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792',
        imageSizeSquare: '1024x1024',
        imageEnhance: false,
        imageEnhanceMaxEdge: 1600,
        imageEnhanceScale: 2
      })
    })
    registerActionsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const draft = (await invokeRegistered(h as never, 'actions:generatePlate', {
      actionId: 'a1'
    })) as { draft?: boolean; path?: string }
    expect(generateImage).toHaveBeenCalled()
    expect(draft.draft ?? true).toBe(true)

    await invokeRegistered(h as never, 'actions:generatePlate', {
      actionId: 'a1',
      persist: true,
      useIdentityEdit: true,
      referenceImagePath: ref,
      referenceImagePaths: [ref, ref2],
      artStyle: 'anime',
      panelLayout: '4panel',
      promptOverride: 'CUSTOM ACTION PLATE'
    })
    expect(editImage).toHaveBeenCalled()
  })

  it('generateIntroVideo and commitPlate', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-act-iv-'))
    const src = join(dir, 's.png')
    const draft = join(dir, 'd.png')
    const out = join(dir, 'out.mp4')
    const finalPath = join(dir, 'final.png')
    writeFileSync(src, 'png')
    writeFileSync(draft, 'png')
    const long =
      'POLISHED ACTION INTRO VIDEO PROMPT WITH ENOUGH LENGTH FOR ACCEPTANCE XX'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const get = vi.fn(async () =>
      actionRow({
        refGalleryJson: JSON.stringify([
          {
            id: 'g1',
            path: src,
            kind: 'sheet',
            label: 'Plate',
            createdAt: '2020-01-01'
          }
        ]),
        refImagePath: src
      })
    )
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...actionRow(),
      ...(data as object)
    }))
    const append = vi.fn()
    const actionImagePath = vi.fn(() => finalPath)

    const ctxNoVideo = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat },
      actions: () => ({ get, update }) as never
    })
    registerActionsHandlers(ctxNoVideo)
    const h0 = (ctxNoVideo as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h0 as never, 'actions:generateIntroVideo', {
        actionId: 'a1',
        sourceImagePath: '/x.png'
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })
    await expect(
      invokeRegistered(h0 as never, 'actions:generateIntroVideo', {
        actionId: 'a1',
        sourceImagePath: src
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })

    const ctx = makeHandlerContext({
      aiClient: { chat, generateVideo, generateImage: vi.fn() },
      actions: () => ({ get, update }) as never,
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
            actionVideoPath: () => out,
            actionImagePath
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: '16:9' })
    })
    registerActionsHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await invokeRegistered(h as never, 'actions:generateIntroVideo', {
      actionId: 'a1',
      sourceImagePath: src,
      durationSeconds: 6,
      locale: 'en'
    })
    expect(generateVideo).toHaveBeenCalled()

    Object.defineProperty(ctx, 'settings', {
      get: () => ({ aspectRatio: 'invalid' })
    })
    await invokeRegistered(h as never, 'actions:generateIntroVideo', {
      actionId: 'a1',
      sourceImagePath: src,
      locale: 'zh-HK'
    })

    await expect(
      invokeRegistered(h as never, 'actions:commitPlate', {
        actionId: 'a1',
        path: '/missing.png'
      })
    ).rejects.toMatchObject({ message: 'errors.draftNotFound' })
    await invokeRegistered(h as never, 'actions:commitPlate', {
      actionId: 'a1',
      path: draft,
      panelLayout: '4panel',
      label: 'Plate'
    })
    expect(actionImagePath).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'commitActionPlate' })
    )
  })
})
