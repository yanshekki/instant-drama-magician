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

  function storyBundle() {
    return {
      id: 's1',
      title: 'Rain',
      styleNote: 'noir',
      storyCharacters: [
        {
          character: {
            name: 'Ming',
            description: 'courier',
            costume: 'jacket'
          }
        }
      ],
      storyProps: [{ prop: { name: 'Bag', description: 'leather' } }],
      storyScenes: [
        {
          sceneId: 'sc1',
          sceneNumber: 1,
          scriptOverride: null,
          scene: {
            title: 'Alley',
            description: 'wet alley',
            script: 'wait',
            mood: 'tense',
            timeOfDay: 'night',
            weather: 'rain'
          }
        }
      ],
      timeline: [
        {
          id: 'e1',
          order: 0,
          sceneId: 'sc1',
          dialogue: '走',
          character: { name: 'Ming' },
          scene: { title: 'Alley', description: 'wet' },
          prop: { name: 'Bag' }
        }
      ]
    }
  }

  it('suggestFromStory requires storyId and covers all/scene/beat segments', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: SCENE_JSON } }]
    }))
    const prisma = {
      story: {
        findUnique: vi.fn(async () => storyBundle())
      }
    }
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() }
    })
    ;(ctx.host as { getPrisma: () => unknown }).getPrisma = () => prisma
    registerScenesAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers

    await expect(
      invokeRegistered(h as never, 'scenes:aiFill', {
        suggestFromStory: true
      })
    ).rejects.toMatchObject({ message: 'errors.storyIdRequired' })

    // all
    await invokeRegistered(h as never, 'scenes:aiFill', {
      suggestFromStory: true,
      storyId: 's1',
      segmentKey: 'all',
      locale: 'en'
    })
    // scene
    await invokeRegistered(h as never, 'scenes:aiFill', {
      suggestFromStory: true,
      storyId: 's1',
      segmentKey: 'scene:sc1',
      locale: 'zh-HK'
    })
    // beat
    await invokeRegistered(h as never, 'scenes:aiFill', {
      suggestFromStory: true,
      storyId: 's1',
      segmentKey: 'beat:e1',
      locale: 'en'
    })
    expect(chat.mock.calls.length).toBeGreaterThanOrEqual(3)

    await expect(
      invokeRegistered(h as never, 'scenes:aiFill', {
        suggestFromStory: true,
        storyId: 's1',
        segmentKey: 'scene:missing'
      })
    ).rejects.toMatchObject({ message: 'errors.sceneNotLinked' })

    await expect(
      invokeRegistered(h as never, 'scenes:aiFill', {
        suggestFromStory: true,
        storyId: 's1',
        segmentKey: 'beat:missing'
      })
    ).rejects.toMatchObject({ message: 'errors.timelineBeatNotFound' })

    await expect(
      invokeRegistered(h as never, 'scenes:aiFill', {
        suggestFromStory: true,
        storyId: 's1',
        segmentKey: 'weird:x'
      })
    ).rejects.toMatchObject({ message: 'errors.unknownSegmentKey' })

    prisma.story.findUnique.mockResolvedValueOnce(null)
    await expect(
      invokeRegistered(h as never, 'scenes:aiFill', {
        suggestFromStory: true,
        storyId: 'missing'
      })
    ).rejects.toMatchObject({ message: 'errors.storyNotFound' })
  })

  it('refines existing draft without idea', async () => {
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: SCENE_JSON } }]
    }))
    const ctx = makeHandlerContext({
      aiClient: { chat, generateImage: vi.fn() }
    })
    registerScenesAiFill(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'scenes:aiFill', {
      existingDraft: { title: 'Dock', description: 'wet' },
      locale: 'en'
    })) as { profile: { title?: string } }
    expect(r.profile.title).toBeTruthy()
  })
})
