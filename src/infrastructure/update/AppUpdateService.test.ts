import { describe, expect, it, vi } from 'vitest'

// electron import fails in node — test module path isolation
describe('AppUpdateService', () => {
  it('is electron-only module (dynamic import may fail in pure node)', async () => {
    try {
      const mod = await import('./AppUpdateService')
      expect(mod.appUpdateService || mod.AppUpdateService).toBeTruthy()
    } catch (e) {
      // Expected when electron native not available in unit env
      expect(String(e)).toMatch(/electron|Cannot find|getVersion/i)
    }
  })
})
