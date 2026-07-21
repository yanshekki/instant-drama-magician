import { describe, expect, it } from 'vitest'
import { classifyUpdateError, emptyUpdateState } from './updateTypes'

// electron import fails in node — test pure helpers + module path isolation
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

describe('classifyUpdateError', () => {
  it('classifies network errors', () => {
    expect(classifyUpdateError('getaddrinfo ENOTFOUND github.com')).toBe(
      'network'
    )
    expect(classifyUpdateError('Fetch failed')).toBe('network')
  })

  it('classifies feed / 404', () => {
    expect(classifyUpdateError('404 latest-linux.yml not found')).toBe('feed')
  })

  it('classifies signature', () => {
    expect(classifyUpdateError('Code signature invalid')).toBe('signature')
  })

  it('classifies disk and permission', () => {
    expect(classifyUpdateError('ENOSPC: no space left')).toBe('disk')
    expect(classifyUpdateError('EACCES: permission denied')).toBe('permission')
  })
})

describe('emptyUpdateState', () => {
  it('fills defaults', () => {
    const s = emptyUpdateState({
      channel: 'desktop-dev',
      currentVersion: '1.0.0'
    })
    expect(s.status).toBe('idle')
    expect(s.canAutoInstall).toBe(false)
    expect(s.source).toBe('none')
  })
})
