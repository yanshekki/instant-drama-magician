import { describe, expect, it } from 'vitest'
import { buildKeyArtFallbackPrompt } from './keyArtPrompt'

describe('buildKeyArtFallbackPrompt', () => {
  it('locks cover + tall format in zh-HK', () => {
    const p = buildKeyArtFallbackPrompt({
      locale: 'zh-HK',
      storyTitle: '夜巴',
      shotOrder: 1,
      shotType: 'cover',
      pageFormat: 'wide',
      method: 'fresh',
      brief: '雨夜',
      beatText: '開門'
    })
    expect(p).toMatch(/夜巴/)
    expect(p).toMatch(/16:9|橫/)
    expect(p).toMatch(/開門|綁定分鏡/)
    expect(p).not.toMatch(/GEOMETRY LOCK|LAYOUT LOCK/)
  })
})
