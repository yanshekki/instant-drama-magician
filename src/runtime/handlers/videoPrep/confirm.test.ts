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

  function entityGet(still: string, id = 'e1') {
    return vi.fn(async () => ({
      id,
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
      refImagePath: still,
      refSheetPath: still
    }))
  }

  function mediaStore(out: string) {
    return {
      ensureLibraryDirs: vi.fn(),
      ensureStoryDirs: vi.fn(),
      tmpImagePath: () => out.replace(/\.mp4$/, '.png'),
      characterVideoPath: () => out,
      sceneVideoPath: () => out,
      propVideoPath: () => out,
      costumeVideoPath: () => out,
      actionVideoPath: () => out,
      clipPath: () => out,
      clipContinuityStillPath: () => out.replace(/\.mp4$/, '_cont.png')
    }
  }

  it('confirms character-intro video generation', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vp2-'))
    const still = join(dir, 'still.png')
    const source = join(dir, 'src.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(still, 'png')
    writeFileSync(source, 'png')
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const append = vi.fn()
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const get = entityGet(still, 'c1')
    // include source path in gallery for bind branch
    get.mockResolvedValueOnce({
      id: 'c1',
      hardRules: '【禁止】水印',
      refGalleryJson: JSON.stringify([
        {
          id: 'g1',
          path: still,
          kind: 'sheet',
          label: 'Sheet',
          createdAt: '2020-01-01'
        },
        {
          id: 'g2',
          path: source,
          kind: 'sheet',
          label: 'Src',
          createdAt: '2020-01-01'
        }
      ]),
      refImagePath: still,
      refSheetPath: still
    })
    const ctx = makeHandlerContext({
      aiClient: { generateVideo, chat: vi.fn() },
      characters: () => ({ get, update }) as never,
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      generation: () => ({ getMediaStore: () => mediaStore(out) }) as never
    })
    registerVideoPrepConfirm(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:confirm', {
      kind: 'character-intro',
      characterId: 'c1',
      professionalPrompt: 'PROFESSIONAL SHORT DRAMA INTRO PROMPT HERE',
      userExtraPrompt: 'warmer light',
      stillPath: still,
      sourceImagePath: source,
      durationSeconds: 8,
      aspectRatio: '16:9'
    })) as { path: string; promptUsed: string }
    expect(generateVideo).toHaveBeenCalled()
    expect(r.path).toBe(out)
    expect(r.promptUsed).toMatch(/PROFESSIONAL|warmer|禁止|HARD/)
    expect(append).toHaveBeenCalled()
  })

  it('confirms scene/prop/costume/action intro kinds', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vp3-'))
    const still = join(dir, 'still.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(still, 'png')
    const generateVideo = vi.fn(async (req: { outputPath: string }) => ({
      outputPath: req.outputPath,
      degraded: false
    }))
    const update = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const emptyGalleryGet = vi.fn(async () => ({
      id: 'x',
      hardRules: null,
      refGalleryJson: null,
      refImagePath: null
    }))
    const ctx = makeHandlerContext({
      aiClient: { generateVideo, chat: vi.fn() },
      scenes: () => ({ get: emptyGalleryGet, update }) as never,
      props: () => ({ get: emptyGalleryGet, update }) as never,
      costumes: () => ({ get: emptyGalleryGet, update }) as never,
      actions: () => ({ get: emptyGalleryGet, update }) as never,
      generation: () => ({ getMediaStore: () => mediaStore(out) }) as never
    })
    registerVideoPrepConfirm(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const base = {
      professionalPrompt: 'PRO PROMPT FOR INTRO VIDEO GENERATION',
      stillPath: still,
      aspectRatio: '9:16' as const
    }
    await invokeRegistered(h as never, 'videoPrep:confirm', {
      ...base,
      kind: 'scene-intro',
      sceneId: 'sc1'
    })
    await invokeRegistered(h as never, 'videoPrep:confirm', {
      ...base,
      kind: 'prop-intro',
      propId: 'p1'
    })
    await invokeRegistered(h as never, 'videoPrep:confirm', {
      ...base,
      kind: 'costume-intro',
      costumeId: 'cos1'
    })
    await invokeRegistered(h as never, 'videoPrep:confirm', {
      ...base,
      kind: 'action-intro',
      actionId: 'a1'
    })
    expect(generateVideo).toHaveBeenCalledTimes(4)
  })

  it('confirms timeline-clip success and failure paths', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vp4-'))
    const still = join(dir, 'still.png')
    const out = join(dir, 'clip.mp4')
    writeFileSync(still, 'png')
    const setMedia = vi
      .fn()
      .mockResolvedValueOnce({ ok: true }) // GENERATING
      .mockResolvedValueOnce({ ok: true }) // READY
      .mockResolvedValueOnce({ ok: true }) // GENERATING again
      .mockRejectedValueOnce(new Error('set fail')) // FAILED status catch
      .mockResolvedValue({ ok: true })
    const generateVideo = vi
      .fn()
      .mockResolvedValueOnce({ outputPath: out, degraded: true })
      .mockRejectedValueOnce(new Error('video fail'))
    const ctx = makeHandlerContext({
      aiClient: { generateVideo, chat: vi.fn() },
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            hardRules: 'story rules',
            styleNote: 'neon'
          }))
        }) as never,
      timeline: () => ({ setMedia }) as never,
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () =>
          ({
            timelineEntry: {
              findUnique: vi.fn(async () => ({
                id: 'e1',
                characterId: 'c1',
                sceneId: 'sc1',
                propId: 'p1',
                actionId: 'a1',
                characterIds: null,
                sceneIds: null,
                propIds: null,
                actionIds: null
              }))
            },
            character: {
              findMany: vi.fn(async () => [{ id: 'c1', hardRules: 'c' }])
            },
            scene: {
              findMany: vi.fn(async () => [{ id: 'sc1', hardRules: 's' }])
            },
            prop: {
              findMany: vi.fn(async () => [{ id: 'p1', hardRules: 'p' }])
            },
            action: {
              findMany: vi.fn(async () => [{ id: 'a1', hardRules: 'a' }])
            }
          }) as never
      } as never,
      generation: () => ({ getMediaStore: () => mediaStore(out) }) as never
    })
    registerVideoPrepConfirm(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const ok = (await invokeRegistered(h as never, 'videoPrep:confirm', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      professionalPrompt: 'CLIP PROMPT LONG ENOUGH',
      stillPath: still
    })) as { degraded?: boolean }
    expect(ok.degraded).toBe(true)

    await expect(
      invokeRegistered(h as never, 'videoPrep:confirm', {
        kind: 'timeline-clip',
        storyId: 's1',
        entryId: 'e1',
        professionalPrompt: 'CLIP FAIL',
        stillPath: still
      })
    ).rejects.toThrow(/video fail/)

    // empty prompt after merge
    await expect(
      invokeRegistered(h as never, 'videoPrep:confirm', {
        kind: 'character-intro',
        characterId: 'c1',
        professionalPrompt: '   ',
        stillPath: still
      })
    ).rejects.toMatchObject({ message: 'errors.ideaOrDraftRequired' })
  })

  it('gallery append + source bind for character scene prop costume action', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-gal-'))
    const still = join(dir, 'still.png')
    const source = join(dir, 'source.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(still, 's')
    writeFileSync(source, 'src')
    writeFileSync(out, 'v')
    const generateVideo = vi.fn(async () => ({
      outputPath: out,
      polished: true,
      promptUsed: 'P',
      degraded: false
    }))
    const update = vi.fn(async (id: string, d: unknown) => ({ id, ...(d as object) }))
    const mediaStore = (outPath: string) => ({
      ensureLibraryDirs: vi.fn(),
      ensureStoryDirs: vi.fn(),
      tmpImagePath: () => outPath,
      characterVideoPath: () => outPath,
      sceneVideoPath: () => outPath,
      propVideoPath: () => outPath,
      costumeVideoPath: () => outPath,
      actionVideoPath: () => outPath,
      clipContinuityStillPath: () => join(dir!, 'cont.png')
    })
    const galleryEmpty = JSON.stringify([])
    for (const [kind, idKey, svcKey] of [
      ['character-intro', 'characterId', 'characters'],
      ['scene-intro', 'sceneId', 'scenes'],
      ['prop-intro', 'propId', 'props'],
      ['costume-intro', 'costumeId', 'costumes'],
      ['action-intro', 'actionId', 'actions']
    ] as const) {
      const get = vi.fn(async () => ({
        id: 'x1',
        name: 'N',
        title: 'T',
        refGalleryJson: galleryEmpty,
        refImagePath: null,
        refSheetPath: null
      }))
      const ctx = makeHandlerContext({
        aiClient: { generateVideo },
        characters: () => ({ get, update }) as never,
        scenes: () => ({ get, update }) as never,
        props: () => ({ get, update }) as never,
        costumes: () => ({ get, update }) as never,
        actions: () => ({ get, update }) as never,
        timeline: () =>
          ({
            setMedia: vi.fn(async () => ({}))
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
          ({ getMediaStore: () => mediaStore(out) }) as never
      })
      registerVideoPrepConfirm(ctx)
      const h = (ctx as { handlers: Map<string, unknown> }).handlers
      await invokeRegistered(h as never, 'videoPrep:confirm', {
        kind,
        [idKey]: 'x1',
        professionalPrompt: 'PROMPT LONG ENOUGH',
        stillPath: still,
        sourceImagePath: source
      })
    }
    expect(generateVideo).toHaveBeenCalled()
    expect(update).toHaveBeenCalled()
  })

  it('timeline continuity copy + bare return path', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-cont-'))
    const still = join(dir, 'still.png')
    const out = join(dir, 'out.mp4')
    writeFileSync(still, 's')
    writeFileSync(out, 'v')
    const cont = join(dir, 'cont.png')
    const setMedia = vi.fn(async () => ({}))
    const generateVideo = vi.fn(async () => ({
      outputPath: out,
      polished: false,
      promptUsed: 'P',
      degraded: false
    }))
    const ctx = makeHandlerContext({
      aiClient: { generateVideo },
      timeline: () => ({ setMedia }) as never,
      activity: {
        append: vi.fn(),
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never,
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () => ({
          timelineEntry: {
            findUnique: vi.fn(async () => null)
          },
          character: { findMany: vi.fn(async () => []) },
          scene: { findMany: vi.fn(async () => []) },
          prop: { findMany: vi.fn(async () => []) },
          action: { findMany: vi.fn(async () => []) }
        })
      } as never,
      stories: () =>
        ({
          get: vi.fn(async () => ({ id: 's1', hardRules: null }))
        }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureStoryDirs: vi.fn(),
            tmpImagePath: () => out,
            clipPath: () => out,
            clipContinuityStillPath: () => cont
          })
        }) as never
    })
    registerVideoPrepConfirm(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h as never, 'videoPrep:confirm', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      professionalPrompt: 'CLIP PROMPT LONG',
      stillPath: still
    })
    expect(setMedia).toHaveBeenCalled()
  })
})
