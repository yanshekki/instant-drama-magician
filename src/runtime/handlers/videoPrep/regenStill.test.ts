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
})
