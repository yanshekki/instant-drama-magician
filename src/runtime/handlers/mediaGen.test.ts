import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { makeHandlerContext, invokeRegistered } from '../../test/handlerTestUtils'
import { registerMediagenHandlers } from './mediaGen'

describe('registerMediagenHandlers timeline', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  function storyWithEntries(
    entries: Array<Record<string, unknown>>,
    extra: Record<string, unknown> = {}
  ) {
    return {
      id: 's1',
      title: 'Rooftop',
      styleNote: null,
      hardRules: null,
      timeline: entries,
      ...extra
    }
  }

  it('registers mediaGen channels', () => {
    const ctx = makeHandlerContext()
    registerMediagenHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(h.has('mediaGen:extract')).toBe(true)
    expect(h.has('mediaGen:polish')).toBe(true)
    expect(h.has('mediaGen:generateImage')).toBe(true)
  })

  it('extract timeline-still builds prev_clip material when previous still exists', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mg-'))
    const prevStill = join(dir, 'e0_continuity.png')
    writeFileSync(prevStill, 'png')
    const castStill = join(dir, 'cast.png')
    writeFileSync(castStill, 'png')

    const storiesGet = vi.fn(async () =>
      storyWithEntries([
        {
          id: 'e0',
          order: 0,
          startTime: 0,
          endTime: 6,
          dialogue: 'first',
          characterId: 'c1',
          sceneId: null,
          propId: null
        },
        {
          id: 'e1',
          order: 1,
          startTime: 6,
          endTime: 12,
          dialogue: 'second line',
          characterId: 'c1',
          sceneId: null,
          propId: null
        }
      ])
    )
    const charactersGet = vi.fn(async () => ({
      id: 'c1',
      name: 'Keith',
      appearance: 'short hair',
      refImagePath: castStill,
      refSheetPath: null,
      hardRules: null,
      artStyle: null
    }))
    const store = {
      ensureLibraryDirs: vi.fn(),
      ensureTmpDir: vi.fn(),
      ensureStoryDirs: vi.fn(),
      clipContinuityStillPath: (_sid: string, eid: string) =>
        eid === 'e0' ? prevStill : join(dir!, `${eid}_cont.png`),
      readStoryCastPrepJson: () =>
        JSON.stringify({
          version: 1,
          characters: { c1: { refImagePath: castStill, costumeId: null } }
        }),
      writeEntryStillPromptJson: vi.fn(),
      clearEntryStillUserCleared: vi.fn(),
      tmpImagePath: () => join(dir!, 'tmp.png')
    }

    const ctx = makeHandlerContext({
      stories: () => ({ get: storiesGet }) as never,
      characters: () => ({ get: charactersGet }) as never,
      generation: () =>
        ({
          getMediaStore: () => store
        }) as never,
      aiClient: {
        generateImage: vi.fn(),
        editImage: vi.fn(),
        chat: vi.fn()
      }
    })
    // settings used by extract art style paths
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792',
        imageSizeSquare: '1024x1024',
        imageEnhance: false
      })
    })
    registerMediagenHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const r = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1'
    })) as {
      sections: Array<{ id: string; include: boolean }>
      editBaseSectionId: string | null
      entityIds: { storyId?: string; entryId?: string }
    }

    expect(r.entityIds.storyId).toBe('s1')
    expect(r.entityIds.entryId).toBe('e1')
    expect(r.sections.some((s) => s.id === 'prev_clip' && s.include)).toBe(
      true
    )
    expect(r.editBaseSectionId).toBe('prev_clip')
    expect(r.sections.some((s) => s.id === 'beat_profile')).toBe(true)
  })

  it('generateImage timeline-still writes continuity path', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mg-gen-'))
    const contPath = join(dir, 'e1_continuity.png')
    const writeEntryStillPromptJson = vi.fn()
    const store = {
      ensureLibraryDirs: vi.fn(),
      ensureTmpDir: vi.fn(),
      ensureStoryDirs: vi.fn(),
      clipContinuityStillPath: () => contPath,
      clearEntryStillUserCleared: vi.fn(),
      writeEntryStillPromptJson,
      readStoryCastPrepJson: () => null,
      tmpImagePath: () => join(dir!, 'tmp.png'),
      characterImagePath: () => join(dir!, 'c.png'),
      sceneImagePath: () => join(dir!, 's.png'),
      propImagePath: () => join(dir!, 'p.png'),
      actionImagePath: () => join(dir!, 'a.png')
    }
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('png-bytes').toString('base64')
    }))
    const storiesGet = vi.fn(async () =>
      storyWithEntries([
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 8,
          dialogue: 'hi',
          characterId: 'c1'
        }
      ])
    )

    const ctx = makeHandlerContext({
      stories: () => ({ get: storiesGet }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'K',
            hardRules: null,
            artStyle: null
          }))
        }) as never,
      generation: () => ({ getMediaStore: () => store }) as never,
      aiClient: {
        generateImage,
        editImage: vi.fn(),
        chat: vi.fn()
      }
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792',
        imageSizeSquare: '1024x1024',
        imageEnhance: false,
        imageEnhanceMaxEdge: 2048,
        imageEnhanceScale: 1
      })
    })
    registerMediagenHandlers(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1',
      polishedPrompt:
        'A cinematic short-drama keyframe still on a rooftop at golden hour, continuous shot.',
      persist: true
    })) as { path: string; draft: boolean }

    expect(generateImage).toHaveBeenCalled()
    expect(r.path).toBe(contPath)
    expect(r.draft).toBe(false)
    expect(existsSync(contPath)).toBe(true)
    expect(store.clearEntryStillUserCleared).toHaveBeenCalled()
  })
})
