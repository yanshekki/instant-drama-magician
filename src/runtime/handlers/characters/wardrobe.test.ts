import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersWardrobe } from './wardrobe'

const SUGGEST_JSON = JSON.stringify({
  name: 'Night rider',
  costume: 'black leather trench, wet asphalt reflections, helmet under arm',
  artStyle: 'photo_cinematic',
  rationale: 'matches rain chase mood'
})

describe('registerCharactersWardrobe', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersWardrobe(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:suggestWardrobe')).toBe(true)
  })

  it('requires character name', async () => {
    const ctx = makeHandlerContext()
    registerCharactersWardrobe(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:suggestWardrobe', {})
    ).rejects.toMatchObject({ message: 'errors.characterNameRequired' })
  })

  it('suggests wardrobe from name without story', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: SUGGEST_JSON } }]
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
    registerCharactersWardrobe(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:suggestWardrobe', {
      name: 'Ming',
      appearance: 'short hair',
      locale: 'en'
    })) as {
      suggestion: { name: string; costume: string; artStyle: string }
    }
    expect(chat).toHaveBeenCalled()
    expect(r.suggestion.name).toBe('Night rider')
    expect(r.suggestion.costume).toMatch(/leather|trench/i)
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'suggestWardrobe' })
    )
  })

  it('loads character row when characterId provided', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: SUGGEST_JSON } }]
    }))
    const get = vi.fn(async () => ({
      id: 'c1',
      name: '阿明',
      appearance: '短髮',
      costume: '雨衣',
      ageRange: '20s',
      gender: 'm',
      description: '外賣',
      personality: '固執',
      visualTags: 'urban',
      mannerisms: 'helmet',
      costumesJson: JSON.stringify([
        {
          id: 'x',
          name: 'Daily',
          description: 'tee',
          createdAt: 'a',
          updatedAt: 'a'
        }
      ])
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat },
      characters: () => ({ get }) as never
    })
    registerCharactersWardrobe(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:suggestWardrobe', {
      characterId: 'c1',
      locale: 'zh-HK'
    })) as { suggestion: { name: string } }
    expect(get).toHaveBeenCalledWith('c1')
    expect(r.suggestion.name).toBeTruthy()
  })
})
