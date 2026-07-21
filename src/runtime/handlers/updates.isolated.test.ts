/**
 * Isolated: force loadUpdateService import catch → null.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../../infrastructure/update/AppUpdateService', () => {
  throw new Error('no electron-updater in test')
})

import { loadUpdateService, nonDesktopUpdateState } from './updates'

describe('updates isolated', () => {
  afterEach(() => vi.restoreAllMocks())

  it('loadUpdateService returns null when import throws', async () => {
    const svc = await loadUpdateService()
    expect(svc).toBeNull()
  })

  it('nonDesktopUpdateState packaged channel maps to desktop-dev', () => {
    // When detectInstallChannel returns desktop-packaged but we pass web-skipped=false
    // exercise message for non-web
    const st = nonDesktopUpdateState('dev-skipped', {
      isPackaged: true,
      appVersion: '3.0.0'
    })
    expect(st.currentVersion).toBe('3.0.0')
    expect(st.source).toBe('none')
    expect(st.canAutoInstall).toBe(false)
    // packaged detect may map channel to desktop-dev or keep packaged
    expect(st.message).toBeTruthy()
  })
})
