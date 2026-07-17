import { describe, expect, it } from 'vitest'
import { buildAudioMixFilter, secondsToMs } from './audioMix'

describe('audioMix', () => {
  it('builds BGM-only filter', () => {
    const f = buildAudioMixFilter({
      bgmVolume: 0.25,
      dialogueVolume: 1,
      dialogueStartsMs: []
    })
    expect(f).toContain('[1:a]volume=0.25[bg]')
    expect(f).toContain('[bg]apad[a]')
    expect(f).not.toContain('amix')
  })

  it('mixes dialogue stems with adelay', () => {
    const f = buildAudioMixFilter({
      bgmVolume: 0.2,
      dialogueVolume: 0.9,
      dialogueStartsMs: [0, 6000]
    })
    expect(f).toContain('[2:a]adelay=0|0,volume=0.9[d0]')
    expect(f).toContain('[3:a]adelay=6000|6000,volume=0.9[d1]')
    expect(f).toContain('amix=inputs=3')
    expect(f).toContain('[a]')
  })

  it('applies ducking volume expression when windows set', () => {
    const f = buildAudioMixFilter({
      bgmVolume: 0.25,
      dialogueVolume: 1,
      dialogueStartsMs: [0],
      duckWindows: [{ startSeconds: 0, endSeconds: 2 }],
      duckRatio: 0.35
    })
    expect(f).toContain("volume='")
    expect(f).toContain('eval=frame')
    expect(f).toContain('between(t\\,0.000\\,2.000)')
  })

  it('converts seconds to ms', () => {
    expect(secondsToMs(6)).toBe(6000)
    expect(secondsToMs(-1)).toBe(0)
  })
})
