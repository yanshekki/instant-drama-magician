import { describe, expect, it } from 'vitest'
import { chatContentText, type StoryStatus, type MediaStatus } from './index'

describe('types/domain', () => {
  it('status unions accept known values', () => {
    const s: StoryStatus = 'DRAFT'
    const m: MediaStatus = 'READY'
    expect(s).toBe('DRAFT')
    expect(m).toBe('READY')
  })

  it('chatContentText flattens string and multimodal parts', () => {
    expect(chatContentText(null)).toBe('')
    expect(chatContentText(undefined)).toBe('')
    expect(chatContentText('hello')).toBe('hello')
    expect(chatContentText(42 as never)).toBe('')
    expect(
      chatContentText([
        { type: 'text', text: 'a' },
        { type: 'image_url', image_url: { url: 'x' } },
        { type: 'text', text: 'b' },
        null as never,
        { type: 'text' } as never
      ])
    ).toBe('ab')
  })
})
