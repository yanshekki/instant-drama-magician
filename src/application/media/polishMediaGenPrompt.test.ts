import { describe, expect, it, vi } from 'vitest'
import { polishMediaGenPrompt } from './polishMediaGenPrompt'
import type { MediaGenMaterialSection } from '../../domain/mediaGenPrep'

const sections: MediaGenMaterialSection[] = [
  {
    id: 'c',
    kind: 'ref-image',
    title: '角色 · 阿明',
    entityType: 'character',
    imagePath: null,
    text: 'IDENTITY LOCK Ming',
    include: true
  },
  {
    id: 'a',
    kind: 'text-profile',
    title: '動作',
    entityType: 'action',
    text: 'Slash motion',
    include: true
  }
]

describe('polishMediaGenPrompt', () => {
  it('returns polished prompt when LLM returns long text', async () => {
    const chat = vi.fn(async () => ({
      choices: [
        {
          message: {
            content:
              'A detailed cinematic motion board prompt with identity lock for Ming and six panels clearly described end to end.'
          }
        }
      ]
    }))
    const r = await polishMediaGenPrompt({
      ai: { chat } as never,
      kind: 'action-plate',
      includedSections: sections,
      fallbackPrompt: 'FALLBACK TEMPLATE PROMPT THAT IS LONG ENOUGH XX',
      taskHint: 'EXACTLY 6 panels'
    })
    expect(r.polished).toBe(true)
    expect(r.prompt).toMatch(/Ming|six|panels|identity/i)
    expect(chat).toHaveBeenCalled()
    const userMsg = chat.mock.calls[0][0].messages[1]
    expect(userMsg.content).toMatch(/Ref#|MATERIALS|Ming|Slash/i)
  })

  it('falls back when LLM fails', async () => {
    const chat = vi.fn(async () => {
      throw new Error('network')
    })
    const r = await polishMediaGenPrompt({
      ai: { chat } as never,
      kind: 'action-plate',
      includedSections: sections,
      fallbackPrompt: 'FALLBACK TEMPLATE PROMPT THAT IS LONG ENOUGH XX'
    })
    expect(r.polished).toBe(false)
    expect(r.prompt).toMatch(/FALLBACK/)
  })

  it('rejects empty fallback and aborted signal', async () => {
    await expect(
      polishMediaGenPrompt({
        ai: { chat: vi.fn() } as never,
        kind: 'character-intro',
        includedSections: sections,
        fallbackPrompt: '   '
      })
    ).rejects.toMatchObject({ code: 'VALIDATION' })

    const ac = new AbortController()
    ac.abort()
    await expect(
      polishMediaGenPrompt({
        ai: { chat: vi.fn() } as never,
        kind: 'character-intro',
        includedSections: sections,
        fallbackPrompt: 'FALLBACK TEMPLATE PROMPT THAT IS LONG ENOUGH XX',
        signal: ac.signal
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' })
  })

  it('uses userTextOverride and video mode tokens', async () => {
    const chat = vi.fn(async () => ({
      choices: [
        {
          message: {
            content:
              'A polished image-to-video director prompt with camera moves, pacing, and identity lock clearly written for production use.'
          }
        }
      ]
    }))
    const r = await polishMediaGenPrompt({
      ai: { chat } as never,
      kind: 'character-intro',
      mode: 'video',
      includedSections: sections,
      fallbackPrompt: 'FALLBACK TEMPLATE PROMPT THAT IS LONG ENOUGH XX',
      userTextOverride: 'CUSTOM VIDEO POLISH USER BODY LONG ENOUGH',
      hardRules: 'no logo'
    })
    expect(r.polished).toBe(true)
    expect(r.prompt).toMatch(/camera|pacing|identity|no logo|production/i)
    const sys = chat.mock.calls[0][0].messages[0].content as string
    const user = chat.mock.calls[0][0].messages[1].content
    expect(sys.length).toBeGreaterThan(20)
    expect(user).toMatch(/CUSTOM VIDEO POLISH/)
    expect(chat.mock.calls[0][0].max_tokens).toBe(1400)
  })

  it('re-throws CANCELLED from chat and falls back on short extract', async () => {
    const { AppError } = await import('../../types/errors')
    await expect(
      polishMediaGenPrompt({
        ai: {
          chat: vi.fn(async () => {
            throw new AppError('CANCELLED', 'errors.cancelled')
          })
        } as never,
        kind: 'action-plate',
        includedSections: sections,
        fallbackPrompt: 'FALLBACK TEMPLATE PROMPT THAT IS LONG ENOUGH XX'
      })
    ).rejects.toMatchObject({ code: 'CANCELLED' })

    const chat = vi.fn(async () => ({
      choices: [{ message: { content: 'too short' } }]
    }))
    const r = await polishMediaGenPrompt({
      ai: { chat } as never,
      kind: 'action-plate',
      includedSections: sections,
      fallbackPrompt: 'FALLBACK TEMPLATE PROMPT THAT IS LONG ENOUGH XX'
    })
    expect(r.polished).toBe(false)
    expect(r.prompt).toMatch(/FALLBACK/)
  })
})
