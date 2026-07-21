import { describe, expect, it, vi } from 'vitest'
import { AppError } from '../../types/errors'
import type { AIProvider } from '../../types/domain'
import { polishProfessionalVideoPrompt } from './prepareVideoPrompt'

describe('polishProfessionalVideoPrompt', () => {
  it('throws on empty fallback or aborted signal', async () => {
    const ai = {
      chat: vi.fn(),
      generateImage: async () => ({ b64: '' }),
      editImage: async () => ({ b64: '' })
    } as unknown as AIProvider
    await expect(
      polishProfessionalVideoPrompt({
        ai,
        fallbackPrompt: '',
        polishUserContent: 'x'
      })
    ).rejects.toBeInstanceOf(AppError)

    const ac = new AbortController()
    ac.abort()
    await expect(
      polishProfessionalVideoPrompt({
        ai,
        fallbackPrompt: 'fallback long',
        polishUserContent: 'x',
        signal: ac.signal
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' })
  })

  it('returns polished + sealed hard rules when LLM succeeds', async () => {
    const body = 'PROFESSIONAL VIDEO DIRECTOR PROMPT WITH ENOUGH LENGTH'
    const ai = {
      chat: vi.fn(async () => ({
        choices: [{ message: { content: body } }]
      })),
      generateImage: async () => ({ b64: '' }),
      editImage: async () => ({ b64: '' })
    } as unknown as AIProvider
    const r = await polishProfessionalVideoPrompt({
      ai,
      locale: 'en',
      fallbackPrompt: 'FALLBACK_TEMPLATE',
      polishUserContent: 'materials',
      hardRules: '【禁止】水印'
    })
    expect(r.polished).toBe(true)
    expect(r.prompt).toMatch(/PROFESSIONAL|HARD|禁止|水印/)
  })

  it('falls back on chat error and short extract', async () => {
    const aiFail = {
      chat: vi.fn(async () => {
        throw new Error('down')
      }),
      generateImage: async () => ({ b64: '' }),
      editImage: async () => ({ b64: '' })
    } as unknown as AIProvider
    const r1 = await polishProfessionalVideoPrompt({
      ai: aiFail,
      fallbackPrompt: 'FALLBACK_TEMPLATE_PROMPT',
      polishUserContent: 'x',
      hardRules: 'NO logo'
    })
    expect(r1.polished).toBe(false)
    expect(r1.prompt).toMatch(/FALLBACK|NO logo|HARD/)

    const aiShort = {
      chat: vi.fn(async () => ({
        choices: [{ message: { content: 'tiny' } }]
      })),
      generateImage: async () => ({ b64: '' }),
      editImage: async () => ({ b64: '' })
    } as unknown as AIProvider
    const r2 = await polishProfessionalVideoPrompt({
      ai: aiShort,
      fallbackPrompt: 'FALLBACK_TEMPLATE_PROMPT',
      polishUserContent: 'x'
    })
    expect(r2.polished).toBe(false)
  })
})
