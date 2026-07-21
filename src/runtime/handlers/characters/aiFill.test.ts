import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersAiFill } from './aiFill'

const PROFILE_JSON = JSON.stringify({
  name: '阿明',
  description: '外賣仔',
  appearance: '短髮',
  personality: '固執',
  backstory: '夜雨送單',
  costume: '雨衣',
  ageRange: '20s',
  gender: 'm',
  voiceDesc: '低沉',
  spokenLanguages: ['yue'],
  mannerisms: '摸頭盔',
  relationships: '小雨',
  visualTags: 'urban, rain',
  hardRules: '【禁止】水印'
})

describe('registerCharactersAiFill', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersAiFill(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:aiFill')).toBe(true)
  })

  it('rejects empty idea without draft/soul/image', async () => {
    const ctx = makeHandlerContext()
    registerCharactersAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:aiFill', {})
    ).rejects.toMatchObject({ message: 'errors.ideaOrImageRequired' })
  })

  it('fills profile from idea via chat', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: PROFILE_JSON } }]
    }))
    const append = vi.fn()
    const ctx = makeHandlerContext({
      aiClient: {
        chat,
        generateImage: vi.fn(),
        generateVideo: undefined
      },
      activity: {
        append,
        readRecent: vi.fn(),
        query: vi.fn(),
        clear: vi.fn(),
        kinds: vi.fn(),
        path: '/l'
      } as never
    })
    registerCharactersAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:aiFill', {
      idea: '外賣仔',
      locale: 'zh-HK'
    })) as { profile: { name: string }; profileJson: string }
    expect(chat).toHaveBeenCalled()
    expect(r.profile.name).toBe('阿明')
    expect(r.profileJson).toContain('阿明')
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'character',
        message: 'aiFill'
      })
    )
  })

  it('refines when existingDraft present', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: PROFILE_JSON } }]
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
    registerCharactersAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await invokeRegistered(h as never, 'characters:aiFill', {
      idea: '',
      existingDraft: { name: '阿明', appearance: '短髮' },
      locale: 'en'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiRefine' })
    )
  })

  it('covers draft arrays spoken string image en idea and missing-fill raw', async () => {
    const { writeFileSync, mkdtempSync, rmSync } = await import('fs')
    const { join } = await import('path')
    const { tmpdir } = await import('os')
    const dir = mkdtempSync(join(tmpdir(), 'idm-aifill-'))
    const img = join(dir, 'ref.png')
    writeFileSync(img, Buffer.from([137, 80, 78, 71]))

    // incomplete profile forces fillMissingProfileFields chat
    const incomplete = JSON.stringify({
      name: 'OnlyName',
      description: '',
      appearance: '',
      personality: '',
      backstory: '',
      costume: '',
      ageRange: '',
      gender: '',
      voiceDesc: '',
      spokenLanguages: [],
      mannerisms: '',
      relationships: '',
      visualTags: '',
      hardRules: ''
    })
    let call = 0
    const chat = vi.fn(async () => {
      call++
      if (call === 1) {
        return { choices: [{ message: { content: incomplete } }] }
      }
      return { choices: [{ message: { content: PROFILE_JSON } }] }
    })
    const append = vi.fn()
    const findUnique = vi.fn(async () => ({
      title: 'Story T',
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
        getPrisma: () => ({ story: { findUnique } })
      } as never
    })
    registerCharactersAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    // image-only + en locale → English invent idea + aiFillFromImage
    await invokeRegistered(h as never, 'characters:aiFill', {
      idea: '',
      locale: 'en',
      referenceImagePath: img,
      existingDraft: {
        tags: ['a', 'b'],
        count: 2,
        spokenLanguages: 'yue, en,  , '
      },
      soulContent: '  soul body  ',
      storyId: 'st1'
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'aiFillFromImage',
        meta: expect.objectContaining({
          usedImage: true,
          usedSoul: true,
          usedDraft: true
        })
      })
    )

    // zh image-only invent idea path
    call = 0
    await invokeRegistered(h as never, 'characters:aiFill', {
      idea: '',
      locale: 'zh-HK',
      referenceImagePath: img
    })

    // mock story inject on (normally dead false)
    const policy = await import('../../../domain/storyContextPolicy')
    const spy = vi
      .spyOn(policy, 'shouldInjectStoryContextForCharacter')
      .mockReturnValue(true)
    call = 0
    await invokeRegistered(h as never, 'characters:aiFill', {
      idea: 'x',
      storyId: 'st1',
      locale: 'en'
    })
    expect(findUnique).toHaveBeenCalled()
    spy.mockRestore()

    // draft only with empty idea → polish idea (en)
    call = 0
    await invokeRegistered(h as never, 'characters:aiFill', {
      idea: '',
      locale: 'en',
      existingDraft: { name: 'N' }
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiRefine' })
    )

    // non-string draft value (line 40), array spoken with non-strings (77), zh polish (109)
    call = 0
    await invokeRegistered(h as never, 'characters:aiFill', {
      idea: '',
      locale: 'zh-HK',
      existingDraft: {
        count: 3,
        spokenLanguages: ['yue', 12, '  ', 'en'] as unknown as string[]
      }
    })
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'aiRefine' })
    )

    rmSync(dir, { recursive: true, force: true })
  })
})
