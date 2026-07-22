import { describe, expect, it } from 'vitest'
import { settingsDisplayVersion } from './SettingsPage'

describe('settingsDisplayVersion', () => {
  it('prefers non-stub update version', () => {
    expect(settingsDisplayVersion('1.3.1', '1.0.0')).toBe('1.3.1')
    expect(settingsDisplayVersion(' 2.0.0 ', '1.0.0')).toBe('2.0.0')
  })

  it('skips electron-updater stub 0.0.0 for app version', () => {
    expect(settingsDisplayVersion('0.0.0', '1.3.1')).toBe('1.3.1')
    expect(settingsDisplayVersion(null, '1.3.1')).toBe('1.3.1')
    expect(settingsDisplayVersion(undefined, '1.2.0')).toBe('1.2.0')
  })

  it('falls back to em dash when both missing', () => {
    expect(settingsDisplayVersion(null, null)).toBe('—')
    expect(settingsDisplayVersion('', '')).toBe('—')
    expect(settingsDisplayVersion('0.0.0', '')).toBe('0.0.0')
  })
})
