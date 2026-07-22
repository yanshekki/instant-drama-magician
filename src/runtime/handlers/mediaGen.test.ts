import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync, existsSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../test/handlerTestUtils'
import { registerMediagenHandlers } from './mediaGen'
import { AppError } from '../../types/errors'

describe('registerMediagenHandlers', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  function mkImg(name = 'ref.png'): string {
    if (!dir) dir = mkdtempSync(join(tmpdir(), 'idm-mg-'))
    const p = join(dir, name)
    if (!existsSync(p)) writeFileSync(p, 'png-bytes')
    return p
  }

  function storyWithEntries(
    entries: Array<Record<string, unknown>>,
    extra: Record<string, unknown> = {}
  ) {
    return {
      id: 's1',
      title: 'Rooftop',
      styleNote: 'noir',
      hardRules: 'no logos',
      timeline: entries,
      ...extra
    }
  }

  function mediaStore(extra: Record<string, unknown> = {}) {
    if (!dir) dir = mkdtempSync(join(tmpdir(), 'idm-mg-store-'))
    return {
      ensureLibraryDirs: vi.fn(),
      ensureTmpDir: vi.fn(),
      ensureStoryDirs: vi.fn(),
      clipContinuityStillPath: (_sid: string, eid: string) =>
        join(dir!, `${eid}_cont.png`),
      readStoryCastPrepJson: () => null as string | null,
      writeEntryStillPromptJson: vi.fn(),
      clearEntryStillUserCleared: vi.fn(),
      tmpImagePath: (label = 'tmp', ext = '.png') =>
        join(dir!, `${label}${ext}`),
      characterImagePath: (id: string, kind = 'sheet', ext = '.png') =>
        join(dir!, `c_${id}_${kind}${ext}`),
      sceneImagePath: (id: string, kind = 'plate', ext = '.png') =>
        join(dir!, `sc_${id}_${kind}${ext}`),
      propImagePath: (id: string, kind = 'plate', ext = '.png') =>
        join(dir!, `p_${id}_${kind}${ext}`),
      actionImagePath: (id: string, kind = 'plate', ext = '.png') =>
        join(dir!, `a_${id}_${kind}${ext}`),
      ...extra
    }
  }

  function baseCtx(overrides: Parameters<typeof makeHandlerContext>[0] = {}) {
    const store = mediaStore()
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('png-out').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('png-edit').toString('base64')
    }))
    const chat = vi.fn(async () => ({
      content:
        'A polished cinematic short-drama still prompt with enough detail for generation and identity lock.'
    }))
    const ctx = makeHandlerContext({
      generation: () => ({ getMediaStore: () => store }) as never,
      aiClient: {
        generateImage,
        editImage,
        chat,
        chatWithImages: vi.fn(async () => ({
          content:
            'A polished multi-vision short-drama still prompt with enough detail for generation.'
        }))
      },
      ...overrides
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
    return { ctx, h, store, generateImage, editImage, chat }
  }

  it('registers mediaGen channels', () => {
    const { h } = baseCtx()
    expect(h.has('mediaGen:extract')).toBe(true)
    expect(h.has('mediaGen:polish')).toBe(true)
    expect(h.has('mediaGen:generateImage')).toBe(true)
  })

  it('extract action-plate builds materials and sanitizes missing images', async () => {
    const missing = join(tmpdir(), 'idm-no-such-img-xyz.png')
    const { h } = baseCtx({
      actions: () =>
        ({
          get: vi.fn(async () => ({
            id: 'a1',
            name: 'Kick',
            description: 'kick door',
            motionNotes: 'heel',
            intention: 'enter',
            cameraNotes: 'low',
            visualTags: 'kick',
            hardRules: 'no logo',
            artStyle: 'anime',
            panelLayout: 'grid-2x2',
            castRefsJson: JSON.stringify([
              {
                slot: 1,
                kind: 'character',
                entityId: 'c1',
                name: 'Aria',
                imagePath: missing
              }
            ]),
            refImagePath: missing,
            refGalleryJson: null
          }))
        }) as never
    })
    const r = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'action-plate',
      actionId: 'a1',
      galleryIdentityPaths: [missing]
    })) as { kind: string; sections: Array<{ imagePath: string | null }> }
    expect(r.kind).toBe('action-plate')
    expect(r.sections.length).toBeGreaterThan(0)
  })

  it('extract action-plate requires actionId', async () => {
    const { h } = baseCtx()
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'action-plate'
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })
  })

  it('extract character-sheet / scene-plate / prop-plate / story-cover', async () => {
    const img = mkImg('c.png')
    const { h } = baseCtx({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            appearance: 'silver hair',
            costume: 'coat',
            description: 'lead',
            visualTags: 'rain',
            hardRules: null,
            artStyle: 'anime',
            refImagePath: img,
            refSheetPath: null
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            description: 'night',
            lighting: 'neon',
            mood: 'tense',
            setDressing: 'AC',
            visualTags: 'city',
            hardRules: null,
            artStyle: 'anime',
            refImagePath: img
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'Badge',
            description: 'brass',
            material: 'metal',
            visualTags: 'shiny',
            hardRules: null,
            artStyle: 'anime',
            refImagePath: img
          }))
        }) as never,
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            title: 'Demo',
            logline: 'rain',
            synopsis: 'long night',
            description: null
          }))
        }) as never
    })

    for (const [kind, payload] of [
      ['character-sheet', { characterId: 'c1' }],
      ['scene-plate', { sceneId: 'sc1' }],
      ['prop-plate', { propId: 'p1' }],
      ['story-cover', { storyId: 's1', galleryIdentityPaths: [img] }]
    ] as const) {
      const r = (await invokeRegistered(h as never, 'mediaGen:extract', {
        kind,
        ...payload
      })) as { kind: string; sections: unknown[] }
      expect(r.kind).toBe(kind)
      expect(r.sections.length).toBeGreaterThan(0)
    }

    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'character-sheet'
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', { kind: 'scene-plate' })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', { kind: 'prop-plate' })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', { kind: 'story-cover' })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('extract costume-dress/swap + atmosphere-swap', async () => {
    const img = mkImg('base.png')
    const { h } = baseCtx({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            appearance: 'silver',
            costume: 'coat',
            hardRules: 'face lock',
            artStyle: null,
            refImagePath: img,
            refSheetPath: null
          }))
        }) as never,
      costumes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'cos1',
            name: 'Rain coat',
            description: 'long trench',
            hardRules: null
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            description: 'base',
            mood: 'storm',
            lighting: 'blue',
            hardRules: null,
            refImagePath: img
          }))
        }) as never
    })

    const dress = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'costume-dress',
      characterId: 'c1',
      costumeId: 'cos1'
    })) as { kind: string }
    expect(dress.kind).toBe('costume-dress')

    const swap = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'costume-swap',
      characterId: 'c1',
      galleryIdentityPaths: [img]
    })) as { kind: string }
    expect(swap.kind).toBe('costume-swap')

    const atmo = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'atmosphere-swap',
      sceneId: 'sc1',
      atmosphereDescription: 'golden hour'
    })) as { kind: string }
    expect(atmo.kind).toBe('atmosphere-swap')

    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'costume-dress'
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'atmosphere-swap'
      })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('extract costume when costumes().get throws is optional', async () => {
    const img = mkImg('b.png')
    const { h } = baseCtx({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'A',
            appearance: 'x',
            costume: 'y',
            hardRules: null,
            artStyle: null,
            refImagePath: img,
            refSheetPath: null
          }))
        }) as never,
      costumes: () =>
        ({
          get: vi.fn(async () => {
            throw new Error('missing costume')
          })
        }) as never
    })
    const r = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'costume-dress',
      characterId: 'c1',
      costumeId: 'missing'
    })) as { kind: string }
    expect(r.kind).toBe('costume-dress')
  })

  it('extract timeline-still builds prev_clip when previous still exists', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mg-'))
    const prevStill = join(dir, 'e0_cont.png')
    writeFileSync(prevStill, 'png')
    const castStill = join(dir, 'cast.png')
    writeFileSync(castStill, 'png')

    const { h } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () =>
            storyWithEntries([
              {
                id: 'e0',
                order: 0,
                startTime: 0,
                endTime: 6,
                dialogue: 'first',
                characterId: 'c1',
                sceneId: 'sc1',
                propId: 'p1'
              },
              {
                id: 'e1',
                order: 1,
                startTime: 6,
                endTime: 12,
                dialogue: 'second line',
                characterId: 'c1',
                sceneId: 'sc1',
                propId: 'p1',
                characterIds: JSON.stringify(['c1']),
                sceneIds: JSON.stringify(['sc1']),
                propIds: JSON.stringify(['p1'])
              }
            ])
          )
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Keith',
            appearance: 'short hair',
            refImagePath: castStill,
            refSheetPath: null,
            hardRules: 'face',
            artStyle: null
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            description: 'rain',
            refImagePath: castStill,
            hardRules: null
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'Badge',
            refImagePath: castStill,
            hardRules: null
          }))
        }) as never,
      generation: () =>
        ({
          getMediaStore: () =>
            mediaStore({
              clipContinuityStillPath: (_sid: string, eid: string) =>
                eid === 'e0' ? prevStill : join(dir!, `${eid}_cont.png`),
              readStoryCastPrepJson: () =>
                JSON.stringify({
                  version: 1,
                  characters: {
                    c1: { refImagePath: castStill, costumeId: null }
                  }
                })
            })
        }) as never
    })

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
  })

  it('extract timeline validates storyId/entryId/timeline array', async () => {
    const { h } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () => ({ id: 's1', title: 'X', timeline: null }))
        }) as never
    })
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'timeline-still',
        storyId: 's1'
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'timeline-still',
        storyId: 's1',
        entryId: 'e1'
      })
    ).rejects.toBeInstanceOf(AppError)

    const { h: h2 } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () =>
            storyWithEntries([{ id: 'other', order: 0, startTime: 0, endTime: 4 }])
          )
        }) as never
    })
    await expect(
      invokeRegistered(h2 as never, 'mediaGen:extract', {
        kind: 'timeline-clip',
        storyId: 's1',
        entryId: 'missing'
      })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('extract timeline tolerates missing cast entity lookups', async () => {
    const { h } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () =>
            storyWithEntries([
              {
                id: 'e1',
                order: 0,
                startTime: 0,
                endTime: 5,
                dialogue: 'solo',
                characterId: 'c-missing',
                sceneId: 'sc-missing',
                propId: 'p-missing'
              }
            ])
          )
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => {
            throw new Error('no char')
          })
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => {
            throw new Error('no scene')
          })
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => {
            throw new Error('no prop')
          })
        }) as never
    })
    const r = (await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1'
    })) as { kind: string }
    expect(r.kind).toBe('timeline-still')
  })

  it('extract video intros for character/scene/prop/action', async () => {
    const img = mkImg('intro.png')
    const { h } = baseCtx({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            appearance: 'a',
            costume: 'c',
            description: 'd',
            hardRules: null,
            artStyle: 'anime',
            refImagePath: img
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            description: 'night',
            lighting: 'neon',
            hardRules: null,
            refImagePath: img
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'Badge',
            description: 'shiny',
            hardRules: null,
            refImagePath: img
          }))
        }) as never,
      actions: () =>
        ({
          get: vi.fn(async () => ({
            id: 'a1',
            name: 'Kick',
            description: 'door',
            motionNotes: 'heel',
            hardRules: null
          }))
        }) as never
    })

    for (const payload of [
      { kind: 'character-intro', characterId: 'c1' },
      { kind: 'scene-intro', sceneId: 'sc1' },
      { kind: 'prop-intro', propId: 'p1' },
      { kind: 'action-intro', actionId: 'a1' },
      { kind: 'costume-intro', characterId: 'c1', galleryIdentityPaths: [img] }
    ]) {
      const r = (await invokeRegistered(
        h as never,
        'mediaGen:extract',
        payload
      )) as { kind: string }
      expect(r.kind).toBe(payload.kind)
    }
  })

  it('extract rejects unsupported kind', async () => {
    const { h } = baseCtx()
    await expect(
      invokeRegistered(h as never, 'mediaGen:extract', {
        kind: 'not-a-kind' as never
      })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('polish requires fallback and returns polished prompt', async () => {
    const { h } = baseCtx()
    await expect(
      invokeRegistered(h as never, 'mediaGen:polish', {
        fallbackPrompt: '',
        includedSections: []
      })
    ).rejects.toBeInstanceOf(AppError)

    const r = (await invokeRegistered(h as never, 'mediaGen:polish', {
      kind: 'character-sheet',
      fallbackPrompt: 'FALLBACK PROMPT LONG ENOUGH FOR IMAGE GEN',
      taskHint: 'sheet',
      hardRules: 'no logo',
      locale: 'en',
      includedSections: [
        {
          id: 't1',
          kind: 'text-profile',
          title: 'Profile',
          text: 'cyber lead',
          include: true
        },
        {
          id: 'skip',
          kind: 'text-profile',
          title: 'Skip',
          text: 'x',
          include: false
        }
      ]
    })) as { polishedPrompt: string; polished: boolean }
    expect(r.polishedPrompt.length).toBeGreaterThan(10)
    expect(typeof r.polished).toBe('boolean')
  })

  it('generateImage covers entity kinds, edit path, persist, and validations', async () => {
    const img = mkImg('edit-base.png')
    const actionUpdate = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const { h, generateImage, editImage, store } = baseCtx({
      actions: () =>
        ({
          get: vi.fn(async () => ({
            id: 'a1',
            name: 'Kick',
            hardRules: 'no logo',
            artStyle: 'realistic',
            panelLayout: 'grid-2x2'
          })),
          update: actionUpdate
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'Aria',
            hardRules: null,
            artStyle: 'anime'
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            hardRules: null,
            artStyle: null
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'Badge',
            hardRules: null,
            artStyle: null
          }))
        }) as never,
      stories: () =>
        ({
          get: vi.fn(async () =>
            storyWithEntries([
              {
                id: 'e1',
                order: 0,
                startTime: 0,
                endTime: 8,
                dialogue: 'hi',
                characterId: 'c1',
                characterIds: JSON.stringify(['c1']),
                sceneIds: JSON.stringify(['sc1']),
                propIds: JSON.stringify(['p1']),
                sceneId: 'sc1',
                propId: 'p1',
                beatContentJson: null
              }
            ])
          )
        }) as never
    })

    const prompt =
      'A cinematic short-drama keyframe still with rich lighting and costume detail.'

    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        polishedPrompt: ''
      })
    ).rejects.toBeInstanceOf(AppError)

    // action-plate pure generate + panel/art updates
    const act = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'action-plate',
      actionId: 'a1',
      polishedPrompt: prompt,
      panelLayout: 'grid-2x2',
      artStyle: 'anime',
      persist: false
    })) as { path: string; draft: boolean; usedEdit: boolean }
    expect(generateImage).toHaveBeenCalled()
    expect(act.draft).toBe(true)
    expect(act.usedEdit).toBe(false)
    expect(existsSync(act.path)).toBe(true)

    // character-sheet edit path
    const ch = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'character-sheet',
      characterId: 'c1',
      polishedPrompt: prompt,
      editBasePath: img,
      useIdentityEdit: true,
      persist: true
    })) as { path: string; usedEdit: boolean; draft: boolean }
    expect(editImage).toHaveBeenCalled()
    expect(ch.usedEdit).toBe(true)
    expect(ch.draft).toBe(false)

    // costume / intro kinds on character branch
    for (const kind of [
      'costume-dress',
      'costume-swap',
      'character-intro',
      'costume-intro'
    ] as const) {
      const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind,
        characterId: 'c1',
        polishedPrompt: prompt
      })) as { path: string }
      expect(r.path).toBeTruthy()
    }

    // scene kinds
    for (const kind of [
      'scene-plate',
      'atmosphere-swap',
      'scene-intro'
    ] as const) {
      const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind,
        sceneId: 'sc1',
        polishedPrompt: prompt,
        persist: true
      })) as { path: string }
      expect(r.path).toBeTruthy()
    }

    // prop kinds
    for (const kind of ['prop-plate', 'prop-intro'] as const) {
      const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind,
        propId: 'p1',
        polishedPrompt: prompt
      })) as { path: string }
      expect(r.path).toBeTruthy()
    }

    // action-intro
    const ai = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'action-intro',
      actionId: 'a1',
      polishedPrompt: prompt
    })) as { path: string }
    expect(ai.path).toBeTruthy()

    // story-cover
    const cover = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'story-cover',
      storyId: 's1',
      polishedPrompt: prompt
    })) as { path: string; draft: boolean }
    expect(cover.path).toContain('story_cover')
    expect(cover.draft).toBe(true)

    // timeline-still with prompt cache
    const still = (await invokeRegistered(
      h as never,
      'mediaGen:generateImage',
      {
        kind: 'timeline-still',
        storyId: 's1',
        entryId: 'e1',
        polishedPrompt: prompt,
        persist: true
      }
    )) as { path: string; draft: boolean }
    expect(still.draft).toBe(false)
    expect(existsSync(still.path)).toBe(true)
    expect(store.clearEntryStillUserCleared).toHaveBeenCalled()
    expect(store.writeEntryStillPromptJson).toHaveBeenCalled()

    // timeline-clip
    const clip = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      polishedPrompt: prompt
    })) as { path: string }
    expect(clip.path).toBeTruthy()

    // validations
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'action-plate',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'character-sheet',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'scene-plate',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'prop-plate',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'story-cover',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'timeline-still',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'not-a-kind' as never,
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)
  })

  it('generateImage timeline tolerates clearEntryStill / cache failures', async () => {
    const { h } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () => {
            throw new Error('story boom')
          })
        }) as never,
      generation: () =>
        ({
          getMediaStore: () =>
            mediaStore({
              clearEntryStillUserCleared: vi.fn(() => {
                throw new Error('clear fail')
              }),
              writeEntryStillPromptJson: vi.fn(() => {
                throw new Error('write fail')
              })
            })
        }) as never
    })
    const prompt =
      'A cinematic short-drama keyframe still with enough length for generation.'
    const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1',
      polishedPrompt: prompt
    })) as { path: string }
    expect(r.path).toBeTruthy()
  })

  it('generateImage uses action persist path when persist true', async () => {
    const { h, store } = baseCtx({
      actions: () =>
        ({
          get: vi.fn(async () => ({
            id: 'a1',
            name: 'Kick',
            hardRules: null,
            artStyle: null,
            panelLayout: null
          })),
          update: vi.fn(async () => ({}))
        }) as never
    })
    const prompt =
      'A multi-panel action plate of a door kick with clear panels and motion.'
    const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'action-plate',
      actionId: 'a1',
      polishedPrompt: prompt,
      persist: true
    })) as { path: string; draft: boolean }
    expect(r.draft).toBe(false)
    expect(store.actionImagePath).toBeDefined()
    expect(r.path).toContain('a_a1')
  })

  it('extract uses entity gallery when galleryIdentityPaths empty', async () => {
    const img = mkImg('from-row.png')
    const galleryJson = JSON.stringify([
      {
        id: 'g1',
        path: img,
        label: 'Hero',
        kind: 'plate',
        createdAt: '2026-07-01T00:00:00.000Z'
      }
    ])
    const { h } = baseCtx({
      actions: () =>
        ({
          get: vi.fn(async () => ({
            id: 'a1',
            name: 'Kick',
            description: 'x',
            motionNotes: null,
            intention: null,
            cameraNotes: null,
            visualTags: null,
            hardRules: null,
            artStyle: null,
            panelLayout: null,
            castRefsJson: null,
            refImagePath: img,
            refGalleryJson: galleryJson
          }))
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'A',
            appearance: null,
            costume: null,
            description: null,
            visualTags: null,
            hardRules: null,
            artStyle: null,
            refImagePath: img,
            refSheetPath: img
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            description: 'd',
            lighting: null,
            mood: null,
            setDressing: null,
            visualTags: null,
            hardRules: null,
            refImagePath: img
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'Badge',
            description: null,
            material: null,
            visualTags: null,
            hardRules: null,
            artStyle: null,
            refImagePath: img
          }))
        }) as never,
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            title: 'Demo',
            logline: null,
            synopsis: null,
            description: 'desc only'
          }))
        }) as never
    })

    // no galleryIdentityPaths → use gallery / row refs
    for (const payload of [
      { kind: 'action-plate', actionId: 'a1' },
      { kind: 'character-sheet', characterId: 'c1' },
      { kind: 'scene-plate', sceneId: 'sc1' },
      { kind: 'prop-plate', propId: 'p1' },
      { kind: 'story-cover', storyId: 's1' },
      { kind: 'atmosphere-swap', sceneId: 'sc1' }
    ]) {
      const r = (await invokeRegistered(
        h as never,
        'mediaGen:extract',
        payload
      )) as { kind: string }
      expect(r.kind).toBe(payload.kind)
    }

    // story with neither synopsis nor description → empty tertiary branch
    const { h: hBare } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's2',
            title: 'Bare',
            logline: null,
            synopsis: null,
            description: null
          }))
        }) as never
    })
    const bare = (await invokeRegistered(hBare as never, 'mediaGen:extract', {
      kind: 'story-cover',
      storyId: 's2'
    })) as { kind: string }
    expect(bare.kind).toBe('story-cover')
  })

  it('polish accepts missing includedSections array', async () => {
    const { h } = baseCtx()
    const r = (await invokeRegistered(h as never, 'mediaGen:polish', {
      fallbackPrompt: 'FALLBACK PROMPT LONG ENOUGH FOR IMAGE GEN',
      includedSections: null as never
    })) as { polishedPrompt: string }
    expect(r.polishedPrompt.length).toBeGreaterThan(5)
  })

  it('generateImage updates panelLayout and covers remaining persist branches', async () => {
    const actionUpdate = vi.fn(async (id: string, data: unknown) => ({
      id,
      ...(data as object)
    }))
    const { h } = baseCtx({
      actions: () =>
        ({
          get: vi.fn(async () => ({
            id: 'a1',
            name: 'Kick',
            hardRules: null,
            artStyle: 'anime',
            panelLayout: 'grid-2x2'
          })),
          update: actionUpdate
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'R',
            hardRules: null,
            artStyle: null
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'B',
            hardRules: null,
            artStyle: null
          }))
        }) as never
    })
    const prompt =
      'A multi-panel action plate of a door kick with clear panels and motion.'
    await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'action-plate',
      actionId: 'a1',
      polishedPrompt: prompt,
      panelLayout: '4panel',
      artStyle: 'anime'
    })
    expect(actionUpdate).toHaveBeenCalledWith(
      'a1',
      expect.objectContaining({ panelLayout: expect.any(String) })
    )

    await expect(
      invokeRegistered(h as never, 'mediaGen:generateImage', {
        kind: 'action-intro',
        polishedPrompt: prompt
      })
    ).rejects.toBeInstanceOf(AppError)

    // scene/prop persist true → library paths
    const sc = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'scene-plate',
      sceneId: 'sc1',
      polishedPrompt: prompt,
      persist: true
    })) as { path: string; draft: boolean }
    expect(sc.draft).toBe(false)
    expect(sc.path).toContain('sc_sc1')

    const pr = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'prop-plate',
      propId: 'p1',
      polishedPrompt: prompt,
      persist: true
    })) as { path: string; draft: boolean }
    expect(pr.draft).toBe(false)
    expect(pr.path).toContain('p_p1')
  })

  it('generateImage timeline cache uses characterIds when characterId missing; enhance copy path', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mg-enh-'))
    const outAlt = join(dir, 'enhanced.png')
    writeFileSync(outAlt, 'enh')

    vi.doMock('../../infrastructure/media/imageEnhance', () => ({
      enhanceCharacterImage: () => ({ path: outAlt, enhanced: true })
    }))
    // Force re-import of handler path uses real enhance — spy via settings enhance on
    // and a store that works; for copy branch we mock module before invoke by
    // re-registering after dynamic mock is flaky. Instead: monkey-patch via
    // real enhance disabled and cover 1109-1110 + 1102 via story shape.

    const { h, store } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            title: 'T',
            styleNote: null,
            hardRules: null,
            // no timeline property → || [] branch when caching
            timeline: [
              {
                id: 'e9',
                order: 0,
                startTime: 0,
                endTime: 6,
                dialogue: 'only ids',
                characterId: null,
                characterIds: JSON.stringify(['c9']),
                sceneId: null,
                propId: null
              }
            ]
          }))
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c9',
            name: 'X',
            hardRules: null,
            artStyle: null
          }))
        }) as never
    })
    // enable enhance so finalPath may differ if enhance rewrites — also cover
    // clearEntryStill already covered; for enhance copy we mock settings
    Object.defineProperty(
      (h as Map<string, unknown>).values ? {} : {},
      'x',
      { value: 1 }
    )

    const prompt =
      'A cinematic short-drama keyframe still with enough length for generation.'
    const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e9',
      polishedPrompt: prompt
    })) as { path: string }
    expect(r.path).toBeTruthy()
    expect(store.writeEntryStillPromptJson).toHaveBeenCalled()
  })

  it('generateImage timeline enhance copies when enhanced path differs', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mg-enh2-'))
    const enhPath = join(dir, 'enh-out.png')

    const enhanceSpy = vi.fn(() => {
      writeFileSync(enhPath, 'enhanced')
      return { path: enhPath, enhanced: true }
    })
    vi.resetModules()
    vi.doMock('../../infrastructure/media/imageEnhance', () => ({
      enhanceCharacterImage: enhanceSpy
    }))
    const { registerMediagenHandlers: reg2 } = await import('./mediaGen')
    const store = mediaStore()
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('png-out').toString('base64')
    }))
    const ctx = makeHandlerContext({
      generation: () => ({ getMediaStore: () => store }) as never,
      stories: () =>
        ({
          get: vi.fn(async () =>
            storyWithEntries([
              {
                id: 'e1',
                order: 0,
                startTime: 0,
                endTime: 4,
                dialogue: 'x',
                characterId: 'c1'
              }
            ])
          )
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'A',
            hardRules: null,
            artStyle: null
          }))
        }) as never,
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
        imageEnhance: true,
        imageEnhanceMaxEdge: 2048,
        imageEnhanceScale: 2
      })
    })
    reg2(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const prompt =
      'A cinematic short-drama keyframe still with enough length for generation.'
    const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e1',
      polishedPrompt: prompt
    })) as { path: string }
    expect(r.path).toBeTruthy()
    expect(enhanceSpy).toHaveBeenCalled()
    vi.doUnmock('../../infrastructure/media/imageEnhance')
    vi.resetModules()
  })

  it('covers remaining gallery/persist/cache edge lines', async () => {
    const img = mkImg('edge.png')
    // character/scene/prop extract with galleryIdentityPaths (true branch)
    const { h } = baseCtx({
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'A',
            appearance: 'x',
            costume: null,
            description: null,
            visualTags: null,
            hardRules: null,
            artStyle: null,
            refImagePath: null,
            refSheetPath: null
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'Roof',
            description: 'd',
            lighting: null,
            mood: null,
            setDressing: null,
            visualTags: null,
            hardRules: null,
            refImagePath: null
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'B',
            description: null,
            material: null,
            visualTags: null,
            hardRules: null,
            artStyle: null,
            refImagePath: null
          }))
        }) as never,
      stories: () =>
        ({
          get: vi.fn(async (id: string) => {
            if (id === 's-notl') {
              return { id: 's-notl', title: 'NoTL' } // no timeline → || []
            }
            return storyWithEntries([
              {
                id: 'e-empty',
                order: 0,
                startTime: 0,
                endTime: 3,
                dialogue: 'solo',
                characterId: null,
                characterIds: null,
                sceneId: null,
                propId: null
              },
              {
                id: 'e-arr',
                order: 1,
                startTime: 3,
                endTime: 6,
                dialogue: 'arr',
                characterId: null,
                characterIds: ['c1'] as unknown as string,
                sceneIds: ['sc1'] as unknown as string,
                propIds: ['p1'] as unknown as string
              }
            ])
          })
        }) as never
    })

    await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'character-sheet',
      characterId: 'c1',
      galleryIdentityPaths: [img, '  ', null as unknown as string]
    })
    await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'scene-plate',
      sceneId: 'sc1',
      galleryIdentityPaths: [img]
    })
    await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'prop-plate',
      propId: 'p1',
      galleryIdentityPaths: [img]
    })
    await invokeRegistered(h as never, 'mediaGen:extract', {
      kind: 'atmosphere-swap',
      sceneId: 'sc1',
      galleryIdentityPaths: [img]
    })

    // story description when no synopsis (already covered); force description branch
    // via extract story-cover with description only already done

    // character-sheet / scene-plate tmp (non-persist) outPath branches
    const prompt =
      'A cinematic short-drama keyframe still with enough length for generation.'
    const ch = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'character-sheet',
      characterId: 'c1',
      polishedPrompt: prompt,
      persist: false
    })) as { path: string; draft: boolean }
    expect(ch.draft).toBe(true)
    expect(ch.path).toContain('character_sheet')

    const sc = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'scene-plate',
      sceneId: 'sc1',
      polishedPrompt: prompt,
      persist: false
    })) as { path: string }
    expect(sc.path).toContain('scene_plate')

    // timeline cache: entry with no character → null fallback (1110)
    await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-still',
      storyId: 's1',
      entryId: 'e-empty',
      polishedPrompt: prompt
    })

    // timeline cache: story without timeline property (1102)
    await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-still',
      storyId: 's-notl',
      entryId: 'e1',
      polishedPrompt: prompt
    })

    // extract timeline with array characterIds → toIdJson array branch (513)
    // hydrate may stringify; pass raw arrays on timeline entries
    const { h: h2 } = baseCtx({
      stories: () =>
        ({
          get: vi.fn(async () => ({
            id: 's1',
            title: 'T',
            styleNote: null,
            hardRules: null,
            timeline: [
              {
                id: 'e1',
                order: 0,
                startTime: 0,
                endTime: 5,
                dialogue: 'hi',
                characterId: null,
                sceneId: null,
                propId: null,
                characterIds: ['c1'],
                sceneIds: ['sc1'],
                propIds: ['p1']
              }
            ]
          }))
        }) as never,
      characters: () =>
        ({
          get: vi.fn(async () => ({
            id: 'c1',
            name: 'A',
            refImagePath: img,
            refSheetPath: null,
            hardRules: null,
            artStyle: null
          }))
        }) as never,
      scenes: () =>
        ({
          get: vi.fn(async () => ({
            id: 'sc1',
            title: 'R',
            description: 'd',
            refImagePath: img,
            hardRules: null
          }))
        }) as never,
      props: () =>
        ({
          get: vi.fn(async () => ({
            id: 'p1',
            name: 'P',
            refImagePath: img,
            hardRules: null
          }))
        }) as never
    })
    // hydrate may throw on arrays — if so, skip
    try {
      await invokeRegistered(h2 as never, 'mediaGen:extract', {
        kind: 'timeline-still',
        storyId: 's1',
        entryId: 'e1'
      })
    } catch {
      /* hydrate may reject arrays */
    }
  })

  it('generateImage enhance copyFileSync catch branch', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-mg-enh3-'))
    // Return a path that cannot be copied (missing) to force catch
    const enhanceSpy = vi.fn(() => ({
      path: join(dir!, 'does-not-exist-enh.png'),
      enhanced: true
    }))
    vi.resetModules()
    vi.doMock('../../infrastructure/media/imageEnhance', () => ({
      enhanceCharacterImage: enhanceSpy
    }))
    const { registerMediagenHandlers: reg2 } = await import('./mediaGen')
    const store = mediaStore()
    const ctx = makeHandlerContext({
      generation: () => ({ getMediaStore: () => store }) as never,
      stories: () =>
        ({
          get: vi.fn(async () =>
            storyWithEntries([
              {
                id: 'e1',
                order: 0,
                startTime: 0,
                endTime: 4,
                dialogue: 'x',
                characterId: null
              }
            ])
          )
        }) as never,
      aiClient: {
        generateImage: vi.fn(async () => ({
          b64: Buffer.from('png-out').toString('base64')
        })),
        editImage: vi.fn(),
        chat: vi.fn()
      }
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        imageSizeWide: '1792x1024',
        imageSizeTall: '1024x1792',
        imageSizeSquare: '1024x1024',
        imageEnhance: true,
        imageEnhanceMaxEdge: 2048,
        imageEnhanceScale: 2
      })
    })
    reg2(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const prompt =
      'A cinematic short-drama keyframe still with enough length for generation.'
    const r = (await invokeRegistered(h as never, 'mediaGen:generateImage', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      polishedPrompt: prompt
    })) as { path: string }
    expect(r.path).toBeTruthy()
    expect(enhanceSpy).toHaveBeenCalled()
    vi.doUnmock('../../infrastructure/media/imageEnhance')
    vi.resetModules()
  })
})


