import { describe, expect, it } from 'vitest'
import {
  GROK_GATEWAY_BASE_URL,
  GROK_GATEWAY_VIDEO_PATH,
  LEGACY_GROK_BASE_URL,
  LEGACY_GROK_VIDEO_PATH,
  adminUrlFromBase,
  migrateGatewayDefaults
} from './gatewayDefaults'

describe('gatewayDefaults', () => {
  it('exposes official :3847 defaults', () => {
    expect(GROK_GATEWAY_BASE_URL).toBe('http://127.0.0.1:3847/v1')
    expect(GROK_GATEWAY_VIDEO_PATH).toContain(':3847')
  })

  it('migrates exact legacy 39281 defaults', () => {
    const { settings, migrated } = migrateGatewayDefaults({
      baseUrl: LEGACY_GROK_BASE_URL,
      videoPath: LEGACY_GROK_VIDEO_PATH
    })
    expect(migrated).toBe(true)
    expect(settings.baseUrl).toBe(GROK_GATEWAY_BASE_URL)
    expect(settings.videoPath).toBe(GROK_GATEWAY_VIDEO_PATH)
  })

  it('does not migrate custom ports', () => {
    const custom = {
      baseUrl: 'http://127.0.0.1:4000/v1',
      videoPath: 'http://127.0.0.1:4000/v1/videos'
    }
    const { settings, migrated } = migrateGatewayDefaults(custom)
    expect(migrated).toBe(false)
    expect(settings).toEqual(custom)
  })

  it('builds admin url from base', () => {
    expect(adminUrlFromBase('http://127.0.0.1:3847/v1')).toBe(
      'http://127.0.0.1:3847/admin/'
    )
  })
})
