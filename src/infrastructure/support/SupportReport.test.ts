import { describe, expect, it } from 'vitest'
import { redactSettings } from './SupportReport'
import { DEFAULT_SETTINGS } from '../../types/settings'

describe('SupportReport', () => {
  it('redacts api key', () => {
    const r = redactSettings({
      ...DEFAULT_SETTINGS,
      apiKey: 'secret-key-value',
      ttsHttpUrl: 'http://localhost/tts'
    })
    expect(r.apiKey).toBe('[redacted]')
    expect(r.ttsHttpUrl).toBe('[set]')
    expect(r.videoMode).toBe(DEFAULT_SETTINGS.videoMode)
  })
})
