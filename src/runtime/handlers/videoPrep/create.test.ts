import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerVideoPrepCreate } from './create'

describe('registerVideoPrepCreate', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerVideoPrepCreate(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('videoPrep:create')).toBe(true)
  })

  it('rejects missing source path and missing video capability', async () => {
    const ctx = makeHandlerContext({
      aiClient: { generateVideo: undefined, chat: vi.fn() }
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'character-intro',
        characterId: 'c1',
        sourceImagePath: '/no/such/source.png'
      })
    ).rejects.toMatchObject({ message: 'errors.sourceImageRequired' })

    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'character-intro',
        characterId: 'c1',
        stillOnly: false
      })
    ).rejects.toMatchObject({ message: 'errors.videoUnavailable' })
  })

  it('rejects character-intro without characterId', async () => {
    const ctx = makeHandlerContext({
      aiClient: {
        generateVideo: vi.fn(),
        chat: vi.fn(),
        generateImage: vi.fn()
      }
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'character-intro',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.characterIdRequired' })
  })

  it('creates character-intro stillOnly draft', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-'))
    const src = join(dir, 'src.png')
    const stillOut = join(dir, 'still.png')
    writeFileSync(src, 'png')
    const longPrompt =
      'POLISHED CHARACTER INTRO VIDEO PROMPT WITH ENOUGH LENGTH FOR ACCEPTANCE'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: longPrompt } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('STILL').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('STILL').toString('base64')
    }))
    const append = vi.fn()
    const get = vi.fn(async () => ({
      id: 'c1',
      name: 'Ming',
      description: 'courier',
      appearance: 'short hair',
      costume: 'jacket',
      personality: 'stubborn',
      hardRules: 'NO logo',
      spokenLanguages: JSON.stringify(['yue']),
      soulMdPath: null
    }))
    const ctx = makeHandlerContext({
      aiClient: {
        chat,
        generateImage,
        editImage,
        generateVideo: vi.fn()
      },
      characters: () => ({ get }) as never,
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
            tmpImagePath: () => stillOut,
            characterImagePath: () => stillOut,
            sceneImagePath: () => stillOut,
            propImagePath: () => stillOut,
            costumeImagePath: () => stillOut,
            actionImagePath: () => stillOut,
            clipContinuityStillPath: () => stillOut,
            ensureStoryDirs: vi.fn(),
            readStoryCastPrepJson: vi.fn(() => null),
            writeEntryStillPromptJson: vi.fn()
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'character-intro',
      characterId: 'c1',
      sourceImagePath: src,
      stillOnly: true,
      locale: 'en',
      durationSeconds: 8
    })) as {
      kind: string
      stillPath: string
      professionalPrompt: string
      entityIds: { characterId?: string }
    }
    expect(r.kind).toBe('character-intro')
    expect(r.entityIds.characterId).toBe('c1')
    expect(r.stillPath).toBe(stillOut)
    expect(r.professionalPrompt.length).toBeGreaterThan(20)
    expect(chat).toHaveBeenCalled()
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'videoPrepCreate' })
    )
  })

  it('creates scene-intro stillOnly draft', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-sc-'))
    const stillOut = join(dir, 's.png')
    const chat = vi.fn(async () => ({
      choices: [
        {
          message: {
            content:
              'POLISHED SCENE INTRO PROMPT LONG ENOUGH FOR THE EXTRACT THRESHOLD'
          }
        }
      ]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('S').toString('base64')
    }))
    const get = vi.fn(async () => ({
      id: 'sc1',
      title: 'Pier',
      description: 'wet docks',
      hardRules: null,
      artStyle: 'photo_cinematic'
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage, editImage: generateImage },
      scenes: () => ({ get }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => stillOut,
            sceneImagePath: () => stillOut
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'scene-intro',
      sceneId: 'sc1',
      stillOnly: true,
      locale: 'zh-HK'
    })) as { kind: string; entityIds: { sceneId?: string } }
    expect(r.kind).toBe('scene-intro')
    expect(r.entityIds.sceneId).toBe('sc1')
  })

  function stillOnlyCtx(opts: {
    stillOut: string
    props?: unknown
    actions?: unknown
    costumes?: unknown
  }) {
    const long =
      'POLISHED INTRO VIDEO PROMPT WITH SUFFICIENT LENGTH FOR EXTRACT PASS'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('I').toString('base64')
    }))
    return makeHandlerContext({
      aiClient: { chat, generateImage, editImage: generateImage },
      props: opts.props
        ? () => opts.props as never
        : undefined,
      actions: opts.actions
        ? () => opts.actions as never
        : undefined,
      costumes: opts.costumes
        ? () => opts.costumes as never
        : undefined,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => opts.stillOut,
            propImagePath: () => opts.stillOut,
            actionImagePath: () => opts.stillOut,
            costumeImagePath: () => opts.stillOut,
            characterImagePath: () => opts.stillOut,
            sceneImagePath: () => opts.stillOut
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
  }

  it('creates prop/action/costume intro stillOnly', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-pac-'))
    const stillOut = join(dir, 'p.png')

    const propGet = vi.fn(async () => ({
      id: 'p1',
      name: 'Umbrella',
      description: 'red',
      material: 'nylon',
      hardRules: null
    }))
    let ctx = stillOnlyCtx({
      stillOut,
      props: { get: propGet }
    })
    registerVideoPrepCreate(ctx)
    let h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'prop-intro',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.propIdRequired' })
    let r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'prop-intro',
      propId: 'p1',
      stillOnly: true
    })) as { entityIds: { propId?: string } }
    expect(r.entityIds.propId).toBe('p1')

    const actGet = vi.fn(async () => ({
      id: 'a1',
      name: 'Kick',
      description: 'door',
      motionNotes: 'hard',
      intention: 'threat',
      hardRules: null
    }))
    ctx = stillOnlyCtx({ stillOut, actions: { get: actGet } })
    registerVideoPrepCreate(ctx)
    h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'action-intro',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.actionIdRequired' })
    r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'action-intro',
      actionId: 'a1',
      stillOnly: true
    })) as { entityIds: { actionId?: string } }
    expect(r.entityIds.actionId).toBe('a1')

    const cosGet = vi.fn(async () => ({
      id: 'cos1',
      name: 'Raincoat',
      description: 'yellow',
      hardRules: null
    }))
    ctx = stillOnlyCtx({ stillOut, costumes: { get: cosGet } })
    registerVideoPrepCreate(ctx)
    h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'costume-intro',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.costumeIdRequired' })
    r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'costume-intro',
      costumeId: 'cos1',
      stillOnly: true
    })) as { entityIds: { costumeId?: string } }
    expect(r.entityIds.costumeId).toBe('cos1')
  })

  it('timeline-clip requires story and entry', async () => {
    const ctx = makeHandlerContext({
      aiClient: {
        generateVideo: vi.fn(),
        chat: vi.fn(),
        generateImage: vi.fn()
      }
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'timeline-clip',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.storyAndEntryRequired' })
  })

  it('timeline-clip stillOnly builds clip prep from story timeline', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-tl-'))
    const stillOut = join(dir, 'cont.png')
    const long =
      'POLISHED TIMELINE CLIP PROMPT WITH ENOUGH LENGTH FOR THE EXTRACTOR'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('CLIP').toString('base64')
    }))
    const writeEntryStillPromptJson = vi.fn()
    const ensureStoryDirs = vi.fn()
    const clearEntryStillUserCleared = vi.fn()
    const story = {
      id: 's1',
      title: 'Rain Night',
      styleNote: 'neon handheld',
      hardRules: '【禁止】水印',
      characters: [
        {
          id: 'c1',
          name: 'Ming',
          description: 'courier',
          appearance: 'short hair',
          costume: 'jacket',
          hardRules: null,
          spokenLanguages: JSON.stringify(['yue']),
          refImagePath: null
        }
      ],
      scenes: [
        {
          id: 'sc1',
          sceneNumber: 1,
          title: 'Alley',
          description: 'wet alley',
          mood: 'tense',
          lighting: 'neon',
          hardRules: null,
          refImagePath: null
        }
      ],
      props: [
        {
          id: 'p1',
          name: 'Umbrella',
          description: 'red',
          hardRules: null,
          refImagePath: null
        }
      ],
      actions: [],
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 6,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          actionId: null,
          // JSON strings for cache hash path (parseIdList expects string)
          characterIds: JSON.stringify(['c1']),
          sceneIds: JSON.stringify(['sc1']),
          propIds: JSON.stringify(['p1']),
          dialogue: '又係落雨',
          beatContentJson: null,
          mediaStatus: 'EMPTY'
        }
      ]
    }
    const get = vi.fn(async () => story)
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage, editImage: generateImage },
      stories: () => ({ get }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            ensureStoryDirs,
            tmpImagePath: () => stillOut,
            clipContinuityStillPath: () => stillOut,
            readStoryCastPrepJson: vi.fn(() => null),
            writeEntryStillPromptJson,
            clearEntryStillUserCleared
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'timeline-clip',
        storyId: 's1',
        entryId: 'missing',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.timelineEntryNotFound' })

    const r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      stillOnly: true,
      locale: 'zh-HK',
      durationSeconds: 8
    })) as {
      kind: string
      entityIds: { storyId?: string; entryId?: string }
      stillPath: string
      materialsSummary?: string
      durationSeconds?: number
    }
    expect(r.kind).toBe('timeline-clip')
    expect(r.entityIds).toEqual({ storyId: 's1', entryId: 'e1' })
    expect(r.stillPath).toBe(stillOut)
    expect(r.durationSeconds).toBe(8)
    expect(ensureStoryDirs).toHaveBeenCalledWith('s1')
    expect(chat).toHaveBeenCalled()
    expect(generateImage).toHaveBeenCalled()
    expect(writeEntryStillPromptJson).toHaveBeenCalled()
    expect(clearEntryStillUserCleared).toHaveBeenCalledWith('s1', 'e1')
  })

  it('timeline-clip multi-cast with action, prev continuity, and skipStillIfExists', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-tl2-'))
    const stillOut = join(dir, 'e2-cont.png')
    const prevStill = join(dir, 'e1-cont.png')
    writeFileSync(prevStill, 'prev')
    writeFileSync(stillOut, 'existing')
    const long =
      'POLISHED MULTI CAST TIMELINE CLIP PROMPT WITH ENOUGH LENGTH FOR EXTRACT'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('CLIP2').toString('base64')
    }))
    const writeEntryStillPromptJson = vi.fn()
    const readEntryStillPromptJson = vi.fn(() =>
      JSON.stringify({
        version: 1,
        professionalPrompt: long,
        userExtraPrompt: 'keep rain',
        materialsSummary: 'cached materials',
        sourceImagePath: null,
        stillPath: stillOut,
        promptHash: 'h',
        updatedAt: new Date().toISOString(),
        durationSeconds: 6,
        aspectRatio: '16:9'
      })
    )
    const story = {
      id: 's1',
      title: 'Duo Night',
      styleNote: 'handheld',
      hardRules: null,
      characters: [
        {
          id: 'c1',
          name: 'Ming',
          description: 'courier',
          appearance: 'short hair',
          costume: 'jacket',
          hardRules: 'no logo',
          spokenLanguages: 'not-json',
          refImagePath: null
        },
        {
          id: 'c2',
          name: 'Lin',
          description: 'driver',
          appearance: 'long hair',
          costume: 'coat',
          hardRules: null,
          spokenLanguages: JSON.stringify(['yue', 'en']),
          refImagePath: null
        }
      ],
      scenes: [
        {
          id: 'sc1',
          sceneNumber: 1,
          title: 'Alley',
          description: 'wet',
          mood: 'tense',
          lighting: 'neon',
          hardRules: null,
          refImagePath: null
        },
        {
          id: 'sc2',
          sceneNumber: 2,
          title: 'Rooftop',
          description: 'open sky',
          mood: 'cold',
          lighting: 'moon',
          hardRules: null,
          refImagePath: null
        }
      ],
      props: [
        {
          id: 'p1',
          name: 'Umbrella',
          description: 'red',
          hardRules: null,
          refImagePath: null
        },
        {
          id: 'p2',
          name: 'Bag',
          description: 'leather',
          hardRules: null,
          refImagePath: null
        }
      ],
      actions: [
        {
          id: 'a1',
          name: 'Dash',
          description: 'sprint forward',
          motionNotes: 'fast feet',
          intention: 'escape',
          cameraNotes: 'tracking',
          hardRules: null,
          refImagePath: null
        }
      ],
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 5,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          actionId: null,
          characterIds: JSON.stringify(['c1']),
          sceneIds: JSON.stringify(['sc1']),
          propIds: JSON.stringify(['p1']),
          dialogue: '開始',
          beatContentJson: null,
          mediaStatus: 'READY'
        },
        {
          id: 'e2',
          order: 1,
          startTime: 5,
          endTime: 11,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          actionId: 'a1',
          // array multi ids exercise asList array branch
          characterIds: ['c1', 'c2'],
          sceneIds: ['sc1', 'sc2'],
          propIds: ['p1', 'p2'],
          actionIds: ['a1'],
          dialogue: '快啲走',
          beatContentJson: null,
          mediaStatus: 'EMPTY'
        }
      ]
    }
    const get = vi.fn(async () => story)
    const clipContinuityStillPath = vi.fn(
      (_sid: string, entryId: string) =>
        entryId === 'e1' ? prevStill : stillOut
    )
    const ctx = makeHandlerContext({
      settings: {
        aspectRatio: '9:16',
        imageSizeTall: '1024x1792',
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024'
      } as never,
      aiClient: { chat, generateImage, editImage: generateImage },
      stories: () => ({ get }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            ensureStoryDirs: vi.fn(),
            tmpImagePath: () => stillOut,
            clipContinuityStillPath,
            readStoryCastPrepJson: vi.fn(() => null),
            writeEntryStillPromptJson,
            readEntryStillPromptJson,
            clearEntryStillUserCleared: vi.fn()
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    // skipStillIfExists reuses existing continuity still + cache
    const skipped = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e2',
      stillOnly: true,
      skipStillIfExists: true
    })) as { skippedStill?: boolean; stillPath: string; materialsSummary?: string }
    expect(skipped.skippedStill).toBe(true)
    expect(skipped.stillPath).toBe(stillOut)
    expect(writeEntryStillPromptJson).toHaveBeenCalled()
    expect(generateImage).not.toHaveBeenCalled()

    // full still regen path with multi-cast + prev continuity image
    generateImage.mockClear()
    writeEntryStillPromptJson.mockClear()
    // remove existing so skip path not taken
    rmSync(stillOut, { force: true })
    const r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e2',
      stillOnly: true,
      locale: 'en'
    })) as {
      kind: string
      materialsSummary?: string
      polished?: boolean
    }
    expect(r.kind).toBe('timeline-clip')
    expect(generateImage).toHaveBeenCalled()
    expect(chat).toHaveBeenCalled()
    expect(r.materialsSummary).toMatch(/characters:|Ming|Lin|continuity/i)
  })

  it('rejects unknown videoPrep kind', async () => {
    const ctx = makeHandlerContext({
      aiClient: {
        generateVideo: vi.fn(),
        chat: vi.fn(),
        generateImage: vi.fn()
      }
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:create', {
        kind: 'not-a-real-kind',
        stillOnly: true
      })
    ).rejects.toMatchObject({ message: 'errors.unknownVideoPrepKind' })
  })

  it('timeline-clip skipStillIfExists polishes when cache empty', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-skip-'))
    const stillOut = join(dir, 'e1.png')
    writeFileSync(stillOut, 'still')
    const long =
      'POLISHED SKIP STILL EMPTY CACHE PROMPT WITH ENOUGH LENGTH FOR EXTRACT'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('X').toString('base64')
    }))
    const writeEntryStillPromptJson = vi.fn()
    const story = {
      id: 's1',
      title: 'Solo',
      styleNote: null,
      hardRules: null,
      characters: [
        {
          id: 'c1',
          name: 'Ming',
          description: 'courier',
          appearance: null,
          costume: null,
          hardRules: null,
          spokenLanguages: null,
          refImagePath: null
        }
      ],
      scenes: [],
      props: [],
      actions: [],
      timeline: [
        {
          id: 'e1',
          order: 0,
          startTime: 0,
          endTime: 5,
          characterId: 'c1',
          sceneId: null,
          propId: null,
          actionId: null,
          characterIds: JSON.stringify(['c1']),
          dialogue: null,
          beatContentJson: null,
          mediaStatus: 'EMPTY'
        }
      ]
    }
    const ctx = makeHandlerContext({
      settings: {
        aspectRatio: '1:1',
        imageSizeTall: '1024x1792',
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024'
      } as never,
      aiClient: { chat, generateImage, editImage: generateImage },
      stories: () => ({ get: vi.fn(async () => story) }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            ensureStoryDirs: vi.fn(),
            tmpImagePath: () => stillOut,
            clipContinuityStillPath: () => stillOut,
            readStoryCastPrepJson: vi.fn(() => null),
            writeEntryStillPromptJson,
            readEntryStillPromptJson: vi.fn(() => null),
            clearEntryStillUserCleared: vi.fn()
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      stillOnly: true,
      skipStillIfExists: true
    })) as { skippedStill?: boolean; polished?: boolean }
    expect(r.skippedStill).toBe(true)
    expect(chat).toHaveBeenCalled()
    expect(generateImage).not.toHaveBeenCalled()
    expect(writeEntryStillPromptJson).toHaveBeenCalled()
  })

  it('timeline multi-cast multi-scene multi-prop multi-action', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-multi-'))
    const stillOut = join(dir, 'e1.png')
    writeFileSync(stillOut, 's')
    const ref = join(dir, 'r.png')
    writeFileSync(ref, 'r')
    const long =
      'POLISHED MULTI CAST CLIP PROMPT WITH ENOUGH LENGTH FOR THE POLISHER TO ACCEPT IT FULLY'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('X').toString('base64')
    }))
    const story = {
      id: 's1',
      title: 'Multi',
      styleNote: 'noir',
      hardRules: 'no gore',
      characters: [
        {
          id: 'c1',
          name: 'A',
          description: 'one',
          appearance: 'tall',
          costume: 'suit',
          hardRules: null,
          spokenLanguages: 'not-json',
          ageRange: '20',
          gender: 'f',
          personality: 'calm',
          backstory: 'b',
          relationships: 'r',
          mannerisms: 'm',
          voiceDesc: 'v',
          visualTags: 't',
          artStyle: 'photo',
          refImagePath: ref
        },
        {
          id: 'c2',
          name: 'B',
          description: 'two',
          appearance: null,
          costume: null,
          hardRules: null,
          spokenLanguages: JSON.stringify(['en', 'zh']),
          refImagePath: null
        }
      ],
      scenes: [
        {
          id: 'sc1',
          sceneNumber: 1,
          title: 'Pier',
          description: 'wet',
          mood: 'cold',
          lighting: 'neon',
          hardRules: null,
          refImagePath: null
        },
        {
          id: 'sc2',
          sceneNumber: 2,
          title: 'Alley',
          description: 'dark',
          mood: null,
          lighting: null,
          hardRules: null,
          refImagePath: null
        }
      ],
      props: [
        { id: 'p1', name: 'Bag', description: 'red', hardRules: null, refImagePath: null },
        { id: 'p2', name: 'Key', description: 'brass', hardRules: null, refImagePath: null }
      ],
      actions: [
        {
          id: 'a1',
          name: 'Run',
          description: 'sprint',
          motionNotes: 'fast',
          intention: 'escape',
          cameraNotes: 'handheld',
          hardRules: null,
          refImagePath: null
        },
        {
          id: 'a2',
          name: 'Turn',
          description: 'look back',
          motionNotes: null,
          intention: null,
          cameraNotes: null,
          hardRules: null,
          refImagePath: null
        }
      ],
      timeline: [
        {
          id: 'e0',
          order: 0,
          startTime: 0,
          endTime: 4,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          actionId: 'a1',
          characterIds: JSON.stringify(['c1', 'c2']),
          sceneIds: JSON.stringify(['sc1', 'sc2']),
          propIds: JSON.stringify(['p1', 'p2']),
          actionIds: JSON.stringify(['a1', 'a2']),
          dialogue: 'Go!',
          beatContentJson: null,
          mediaStatus: 'READY'
        },
        {
          id: 'e1',
          order: 1,
          startTime: 4,
          endTime: 9,
          characterId: 'c1',
          sceneId: 'sc1',
          propId: 'p1',
          actionId: 'a1',
          characterIds: JSON.stringify(['c1', 'c2']),
          sceneIds: JSON.stringify(['sc1', 'sc2']),
          propIds: JSON.stringify(['p1', 'p2']),
          actionIds: JSON.stringify(['a1', 'a2']),
          dialogue: null,
          beatContentJson: JSON.stringify({ beat: 'chase' }),
          mediaStatus: 'EMPTY'
        }
      ]
    }
    const prevStill = join(dir, 'prev.png')
    writeFileSync(prevStill, 'p')
    const ctx = makeHandlerContext({
      settings: {
        aspectRatio: '9:16',
        imageSizeTall: '1024x1792',
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024'
      } as never,
      aiClient: { chat, generateImage, editImage: generateImage, generateVideo: vi.fn() },
      stories: () => ({ get: vi.fn(async () => story) }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            ensureStoryDirs: vi.fn(),
            tmpImagePath: () => stillOut,
            clipContinuityStillPath: (_s: string, eid: string) =>
              eid === 'e0' ? prevStill : stillOut,
            readStoryCastPrepJson: vi.fn(() => null),
            writeEntryStillPromptJson: vi.fn(),
            readEntryStillPromptJson: vi.fn(() => null),
            clearEntryStillUserCleared: vi.fn(),
            isEntryStillUserCleared: vi.fn(() => false)
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepCreate(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:create', {
      kind: 'timeline-clip',
      storyId: 's1',
      entryId: 'e1',
      stillOnly: true
    })) as { professionalPrompt?: string }
    expect(chat).toHaveBeenCalled()
    expect(r.professionalPrompt || long).toBeTruthy()
  })

  it('entity intros seal hardRules for scene prop action costume', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-vpc-ent-'))
    const stillOut = join(dir, 's.png')
    const long = 'POLISHED ENTITY INTRO PROMPT LONG ENOUGH FOR ACCEPTANCE THRESHOLD'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: long } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('X').toString('base64')
    }))
    const baseMedia = {
      ensureLibraryDirs: vi.fn(),
      ensureTmpDir: vi.fn(),
      tmpImagePath: () => stillOut,
      characterImagePath: () => stillOut,
      sceneImagePath: () => stillOut,
      propImagePath: () => stillOut,
      actionImagePath: () => stillOut,
      costumeImagePath: () => stillOut
    }
    for (const [kind, idKey, factory] of [
      ['scene-intro', 'sceneId', 'scenes'],
      ['prop-intro', 'propId', 'props'],
      ['action-intro', 'actionId', 'actions'],
      ['costume-intro', 'costumeId', 'costumes']
    ] as const) {
      const get = vi.fn(async () => ({
        id: 'x1',
        name: 'N',
        title: 'T',
        description: 'd',
        hardRules: 'NO TEXT',
        artStyle: null,
        refImagePath: null
      }))
      const ctx = makeHandlerContext({
        settings: {
          aspectRatio: '1:1',
          imageSizeSquare: '1024x1024',
          imageSizeWide: '1792x1024',
          imageSizeTall: '1024x1792'
        } as never,
        aiClient: { chat, generateImage, editImage: generateImage, generateVideo: vi.fn() },
        scenes: () => ({ get }) as never,
        props: () => ({ get }) as never,
        actions: () => ({ get }) as never,
        costumes: () => ({ get }) as never,
        generation: () =>
          ({
            getMediaStore: () => baseMedia,
            cancel: vi.fn(),
            rebindAi: vi.fn()
          }) as never
      })
      registerVideoPrepCreate(ctx)
      const h = (ctx as { handlers: Map<string, unknown> }).handlers
      await invokeRegistered(h as never, 'videoPrep:create', {
        kind,
        [idKey]: 'x1',
        stillOnly: true
      })
    }
    expect(chat.mock.calls.length).toBeGreaterThan(3)
  })
})
