import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerScenesAiFill } from './aiFill'

const SCENE_JSON = JSON.stringify({
  title: '碼頭倉庫',
  description: '鏽鐵門與濕潤碼頭，霓虹滲進積水',
  script: '阿明在門口等待',
  locationType: 'exterior',
  timeOfDay: 'night',
  weather: 'rain',
  mood: 'tense',
  lighting: 'neon spill',
  colorPalette: 'teal orange',
  setDressing: 'crates',
  soundscape: 'harbor',
  cameraNotes: 'slow push',
  visualTags: 'wet, industrial',
  hardRules: '【禁止】水印'
})

describe('registerScenesAiFill', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerScenesAiFill(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('scenes:aiFill')).toBe(true)
  })

  it('rejects empty payload', async () => {
    const ctx = makeHandlerContext()
    registerScenesAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'scenes:aiFill', {})
    ).rejects.toBeTruthy()
  })

  it('fills scene profile from idea', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: SCENE_JSON } }]
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
    registerScenesAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:aiFill', {
      idea: '雨夜碼頭',
      locale: 'zh-HK'
    })) as { profile: { title?: string; description?: string } }
    expect(chat).toHaveBeenCalled()
    expect(r.profile.description || r.profile.title).toBeTruthy()
  })
})
