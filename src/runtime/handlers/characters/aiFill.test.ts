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
})
