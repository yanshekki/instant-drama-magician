import { describe, expect, it, vi } from 'vitest'
import {
  settingsDisplayVersion,
  settingsOpenReleasePage,
  settingsVersionRangeLabel
} from './SettingsPage'

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

describe('settingsVersionRangeLabel', () => {
  it('shows desktop or npm latest arrow when newer', () => {
    expect(settingsVersionRangeLabel('1.3.1', '1.3.2', null, false)).toBe(
      '1.3.1 → 1.3.2'
    )
    expect(
      settingsVersionRangeLabel('1.3.1', null, '1.3.2', true)
    ).toBe('1.3.1 → 1.3.2')
    expect(settingsVersionRangeLabel('1.3.2', null, '1.3.2', false)).toBe(
      '1.3.2'
    )
  })
})

describe('settingsOpenReleasePage preferBrowser', () => {
  it('opens client-side without calling server openRelease', async () => {
    const openRelease = vi.fn()
    const openExternal = vi.fn(async () => undefined)
    await settingsOpenReleasePage({
      openRelease,
      version: '1.3.2',
      preferBrowser: true,
      openExternal,
      toastError: vi.fn(),
      failMsg: (m) => m || 'f',
      failSimple: 'fs'
    })
    expect(openRelease).not.toHaveBeenCalled()
    expect(openExternal).toHaveBeenCalledWith(
      expect.stringContaining('github.com/yanshekki/instant-drama-magician/releases')
    )
  })
})
