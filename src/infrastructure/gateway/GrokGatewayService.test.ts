import { describe, expect, it } from 'vitest'
import * as Mod from './GrokGatewayService'
import { GrokGatewayService } from './GrokGatewayService'

describe('GrokGatewayService', () => {
  it('exports service helpers', () => {
    expect(Object.keys(Mod).length).toBeGreaterThan(0)
  })

  it('parseCreatedApiKey reads labeled key line from gctoac output', () => {
    const sample = `✓ API key created (store it securely — shown once):
  id:     24b1c44a-9d02-42c8-8564-55536e256e25
  name:   instant-drama-magician
  role:   admin
  mode:   agent
  prefix: gk_live_zbrDdQ7M
  key:    gk_live_zbrDdQ7M6j0ulOl2Cey2BUpKFTh3Y8hz

Admin:  http://127.0.0.1:3847/admin/
`
    expect(GrokGatewayService.parseCreatedApiKey(sample)).toBe(
      'gk_live_zbrDdQ7M6j0ulOl2Cey2BUpKFTh3Y8hz'
    )
  })

  it('parseCreatedApiKey prefers full key over short prefix tokens', () => {
    const sample =
      'prefix: gk_live_EzXe8TvX\nkey: gk_live_EzXe8TvXABCDEFGHIJKLMNOPQRST'
    expect(GrokGatewayService.parseCreatedApiKey(sample)).toBe(
      'gk_live_EzXe8TvXABCDEFGHIJKLMNOPQRST'
    )
  })

  it('parseCreatedApiKey returns null when no key present', () => {
    expect(GrokGatewayService.parseCreatedApiKey('nothing here')).toBeNull()
    expect(GrokGatewayService.parseCreatedApiKey('')).toBeNull()
  })

  it('baseUrl targets OpenAI-compatible /v1', () => {
    const gw = new GrokGatewayService(3847)
    expect(gw.baseUrl).toBe('http://127.0.0.1:3847/v1')
    expect(gw.adminUrl).toBe('http://127.0.0.1:3847/admin/')
  })
})
