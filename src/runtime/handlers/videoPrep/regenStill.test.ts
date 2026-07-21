import { describe, expect, it, vi, afterEach } from 'vitest'
import { writeFileSync, mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerVideoPrepRegenStill } from './regenStill'

describe('registerVideoPrepRegenStill', () => {
  let dir: string | undefined
  afterEach(() => {
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
      dir = undefined
    }
    vi.restoreAllMocks()
  })

  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerVideoPrepRegenStill(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('videoPrep:regenStill')).toBe(true)
  })

  it('validates notes and professional prompt', async () => {
    const ctx = makeHandlerContext()
    registerVideoPrepRegenStill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'videoPrep:regenStill', {
        professionalPrompt: 'PRO',
        improvementNotes: '  '
      })
    ).rejects.toMatchObject({ message: 'errors.ideaOrDraftRequired' })
    await expect(
      invokeRegistered(h as never, 'videoPrep:regenStill', {
        professionalPrompt: '',
        improvementNotes: 'warmer'
      })
    ).rejects.toMatchObject({ message: 'errors.ideaOrDraftRequired' })
  })

  it('polishes and regenerates still for character', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-regen-'))
    const src = join(dir, 'src.png')
    writeFileSync(src, 'x')
    const longPrompt =
      'IMPROVED PROFESSIONAL VIDEO PROMPT WITH ENOUGH CHARACTERS FOR EXTRACT'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: longPrompt } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('PNG').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('PNG').toString('base64')
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      hardRules: 'NO logo'
    }))
    const outStill = join(dir, 'out.png')
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage, editImage, generateVideo: vi.fn() },
      characters: () => ({ get }) as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: () => outStill,
            characterImagePath: () => outStill,
            sceneImagePath: () => outStill,
            propImagePath: () => outStill,
            costumeImagePath: () => outStill,
            clipContinuityStillPath: () => outStill,
            ensureStoryDirs: vi.fn()
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerVideoPrepRegenStill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'videoPrep:regenStill', {
      professionalPrompt: 'BASE PROMPT LONG ENOUGH FOR FALLBACK USE',
      improvementNotes: 'warmer light please',
      characterId: 'c1',
      sourceImagePath: src,
      locale: 'en',
      durationSeconds: 6,
      aspectRatio: '16:9'
    })) as {
      stillPath?: string
      professionalPrompt?: string
      stillPromptUsed?: string
    }
    expect(chat).toHaveBeenCalled()
    expect(r.stillPath).toBe(outStill)
    expect(r.professionalPrompt).toBeTruthy()
  })

  it('loads hard rules for scene/prop/costume/action/timeline and path variants', async () => {
    dir = mkdtempSync(join(tmpdir(), 'idm-regen2-'))
    const outStill = join(dir, 'out.png')
    const longPrompt =
      'IMPROVED PROFESSIONAL VIDEO PROMPT WITH ENOUGH CHARACTERS FOR EXTRACT XX'
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: longPrompt } }]
    }))
    const generateImage = vi.fn(async () => ({
      b64: Buffer.from('PNG').toString('base64')
    }))
    const editImage = vi.fn(async () => ({
      b64: Buffer.from('PNG').toString('base64')
    }))
    const getEntity = vi.fn(async () => ({ id: 'x', hardRules: 'RULES' }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage, editImage, generateVideo: vi.fn() },
      scenes: () => ({ get: getEntity }) as never,
      props: () => ({ get: getEntity }) as never,
      costumes: () => ({ get: getEntity }) as never,
      actions: () => ({ get: getEntity }) as never,
      stories: () =>
        ({
          get: vi.fn(async () => ({ id: 's1', hardRules: 'S' }))
        }) as never,
      host: {
        ...(makeHandlerContext().host as object),
        getPrisma: () =>
          ({
            timelineEntry: {
              findUnique: vi.fn(async () => ({
                id: 'e1',
                characterId: 'c1',
                sceneId: null,
                propId: null,
                actionId: null
              }))
            },
            character: {
              findMany: vi.fn(async () => [{ id: 'c1', hardRules: 'c' }])
            },
            scene: { findMany: vi.fn(async () => []) },
            prop: { findMany: vi.fn(async () => []) },
            action: { findMany: vi.fn(async () => []) }
          }) as never
      } as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            ensureStoryDirs: vi.fn(),
            tmpImagePath: () => outStill,
            characterImagePath: () => outStill,
            sceneImagePath: () => outStill,
            propImagePath: () => outStill,
            costumeImagePath: () => outStill,
            clipContinuityStillPath: () => outStill
          })
        }) as never
    })
    Object.defineProperty(ctx, 'settings', {
      get: () => ({
        aspectRatio: '1:1',
        imageSizeTall: '1024x1792',
        imageSizeWide: '1792x1024',
        imageSizeSquare: '1024x1024'
      })
    })
    registerVideoPrepRegenStill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const base = {
      professionalPrompt: 'BASE PROMPT LONG ENOUGH FOR FALLBACK USE HERE',
      improvementNotes: 'sharper'
    }
    await invokeRegistered(h as never, 'videoPrep:regenStill', {
      ...base,
      sceneId: 'sc1',
      aspectRatio: '9:16',
      locale: 'zh-HK'
    })
    await invokeRegistered(h as never, 'videoPrep:regenStill', {
      ...base,
      propId: 'p1'
    })
    await invokeRegistered(h as never, 'videoPrep:regenStill', {
      ...base,
      costumeId: 'cos1'
    })
    await invokeRegistered(h as never, 'videoPrep:regenStill', {
      ...base,
      actionId: 'a1'
    })
    await invokeRegistered(h as never, 'videoPrep:regenStill', {
      ...base,
      storyId: 's1',
      entryId: 'e1',
      aspectRatio: '16:9'
    })
    await invokeRegistered(h as never, 'videoPrep:regenStill', {
      ...base,
      stillOutputHint: outStill
    })
    expect(generateImage.mock.calls.length + editImage.mock.calls.length).toBeGreaterThan(
      3
    )
  })
})
