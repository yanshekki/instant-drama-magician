import { describe, expect, it, vi } from 'vitest'
import {
  makeHandlerContext,
  invokeRegistered
} from '../../../test/handlerTestUtils'
import { registerCharactersSoul } from './soul'

describe('registerCharactersSoul', () => {
  it('registers expected channels', () => {
    const ctx = makeHandlerContext()
    registerCharactersSoul(ctx)
    const handlers = (ctx as { handlers: Map<string, unknown> }).handlers
    expect(handlers.has('characters:generateSoul')).toBe(true)
  })

  it('rejects empty profile without existing soul', async () => {
    const ctx = makeHandlerContext()
    registerCharactersSoul(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    await expect(
      invokeRegistered(h as never, 'characters:generateSoul', {
        profile: {}
      })
    ).rejects.toMatchObject({ message: 'errors.ideaOrDraftRequired' })
  })

  it('generates soul markdown from profile', async () => {
    const soulMd = [
      '# 阿明',
      '',
      '## Identity',
      'Courier who rides through rainy nights delivering meals.',
      '## Appearance',
      'Short hair, delivery jacket, helmet.',
      '## Personality & voice',
      'Stubborn, low voice, cares deeply.'
    ].join('\n')
    const chat = vi.fn(async () => ({
      choices: [{ message: { content: soulMd } }]
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
      } as never,
      generation: () =>
        ({
          getMediaStore: () => ({
            ensureLibraryDirs: vi.fn(),
            ensureTmpDir: vi.fn(),
            tmpImagePath: (prefix: string, ext = '.md') =>
              `/tmp/${prefix}${ext}`,
            tmpPath: () => '/tmp/x'
          }),
          cancel: vi.fn(),
          rebindAi: vi.fn()
        }) as never
    })
    registerCharactersSoul(ctx)
    const h = (ctx as { handlers: Map<string, unknown> }).handlers
    const r = (await invokeRegistered(h as never, 'characters:generateSoul', {
      profile: { name: '阿明', appearance: '短髮' },
      locale: 'zh-HK'
    })) as { content: string; title: string; filePath: string }
    expect(chat).toHaveBeenCalled()
    expect(r.content).toMatch(/阿明|Identity|Courier/)
    expect(r.title).toBeTruthy()
    expect(r.filePath).toMatch(/soul_/)
  })
})
