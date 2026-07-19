import { describe, expect, it } from 'vitest'
import { GrokCliClient } from './GrokCliClient'
import { DEFAULT_SETTINGS } from '../../types/settings'

describe('GrokCliClient', () => {
  it('constructs with settings', () => {
    const c = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      apiKey: '',
      baseUrl: 'http://127.0.0.1:9'
    })
    expect(c).toBeTruthy()
  })

  it('getStatus returns structure when offline', async () => {
    const c = new GrokCliClient({
      ...DEFAULT_SETTINGS,
      apiKey: '',
      baseUrl: 'http://127.0.0.1:1'
    })
    const st = await c.getStatus()
    expect(st).toHaveProperty('available')
  }, 15_000)
})
