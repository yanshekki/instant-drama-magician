import { describe, expect, it } from 'vitest'
import { buildSrt, formatSrtTime } from './subtitle'

describe('subtitle', () => {
  it('formats srt timestamps', () => {
    expect(formatSrtTime(0)).toBe('00:00:00,000')
    expect(formatSrtTime(65.5)).toBe('00:01:05,500')
  })

  it('builds srt content', () => {
    const srt = buildSrt([
      { startSeconds: 0, endSeconds: 2, text: 'Hello' },
      { startSeconds: 2, endSeconds: 4, text: 'World' }
    ])
    expect(srt).toContain('1\n00:00:00,000 --> 00:00:02,000\nHello')
    expect(srt).toContain('2\n00:00:02,000 --> 00:00:04,000\nWorld')
  })

  it('skips empty cues', () => {
    expect(buildSrt([{ startSeconds: 0, endSeconds: 1, text: '  ' }])).toBe('')
  })
})
