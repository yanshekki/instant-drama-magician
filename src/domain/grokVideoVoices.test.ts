import { describe, expect, it } from 'vitest'
import {
  appendGrokVoicePromptHints,
  coerceGrokVideoVoice,
  inferGrokVoiceFromCharacter,
  mapGrokClipVoices,
  sanitizeGrokVoices
} from './grokVideoVoices'

describe('grokVideoVoices', () => {
  it('coerces unknown ids to ara', () => {
    expect(coerceGrokVideoVoice('eve')).toBe('eve')
    expect(coerceGrokVideoVoice('NOPE')).toBe('ara')
    expect(sanitizeGrokVoices(['eve', 'eve', 'leo', 'x', 'rex', 'sal'])).toEqual(
      ['eve', 'leo', 'rex']
    )
  })

  it('maps gender / voiceDesc and de-dupes', () => {
    expect(
      inferGrokVoiceFromCharacter({ gender: '女', defaultVoice: 'ara' })
    ).toBe('eve')
    expect(
      inferGrokVoiceFromCharacter({ gender: 'male', defaultVoice: 'ara' })
    ).toBe('leo')
    expect(mapGrokClipVoices([], 'mio')).toEqual(['mio'])
    expect(
      mapGrokClipVoices(
        [
          { gender: 'female' },
          { gender: 'female' },
          { gender: 'male' }
        ],
        'ara'
      )
    ).toEqual(['eve', 'ara', 'leo'])
  })

  it('appends AUDIO tags', () => {
    expect(appendGrokVoicePromptHints('Hello', [])).toBe('Hello')
    expect(appendGrokVoicePromptHints('Hello', ['eve'])).toMatch(/AUDIO_0/)
  })
})
