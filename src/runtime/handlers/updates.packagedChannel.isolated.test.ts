/**
 * Isolated nonDesktopUpdateState desktop-packaged branch.
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('../../domain/installChannel', () => ({
  detectInstallChannel: () => 'desktop-packaged',
  githubReleaseUrl: () => 'https://github.com/r/releases'
}))

import { nonDesktopUpdateState } from './updates'

describe('nonDesktopUpdateState packaged channel', () => {
  it('maps desktop-packaged to desktop-dev channel label', () => {
    const st = nonDesktopUpdateState('dev-skipped', {
      isPackaged: true,
      appVersion: '1.2.3'
    })
    expect(st.channel).toBe('desktop-dev')
    expect(st.status).toBe('dev-skipped')
    expect(st.message).toMatch(/packaged/i)
    expect(st.messageKey).toBe('updateDevSkipped')
  })
})
