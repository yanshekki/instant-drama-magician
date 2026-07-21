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
})

