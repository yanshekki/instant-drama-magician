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
})
