import { describe, expect, it } from 'vitest'
import {
  channelAllowsDesktopAutoUpdate,
  channelAllowsNpmAutoUpdate,
  detectInstallChannel,
  githubReleaseUrl,
  GITHUB_RELEASES_URL
} from './installChannel'

describe('detectInstallChannel', () => {
  it('prefers CLI over other signals', () => {
    expect(
      detectInstallChannel({
        isCli: true,
        isElectron: true,
        isPackaged: true,
        isWeb: true
      })
    ).toBe('cli-npm')
  })

  it('detects web', () => {
    expect(detectInstallChannel({ isWeb: true })).toBe('web')
  })

  it('detects packaged desktop', () => {
    expect(
      detectInstallChannel({ isElectron: true, isPackaged: true })
    ).toBe('desktop-packaged')
  })

  it('detects desktop dev', () => {
    expect(
      detectInstallChannel({ isElectron: true, isPackaged: false })
    ).toBe('desktop-dev')
  })

  it('falls back to cli-npm outside Electron', () => {
    expect(detectInstallChannel({})).toBe('cli-npm')
  })
})

describe('githubReleaseUrl', () => {
  it('returns list URL without version', () => {
    expect(githubReleaseUrl()).toBe(GITHUB_RELEASES_URL)
    expect(githubReleaseUrl(null)).toBe(GITHUB_RELEASES_URL)
  })

  it('builds tag URL with optional v prefix', () => {
    expect(githubReleaseUrl('1.2.0')).toBe(
      `${GITHUB_RELEASES_URL}/tag/v1.2.0`
    )
    expect(githubReleaseUrl('v1.2.0')).toBe(
      `${GITHUB_RELEASES_URL}/tag/v1.2.0`
    )
  })
})

describe('channel capabilities', () => {
  it('only packaged desktop auto-updates via GitHub', () => {
    expect(channelAllowsDesktopAutoUpdate('desktop-packaged')).toBe(true)
    expect(channelAllowsDesktopAutoUpdate('desktop-dev')).toBe(false)
    expect(channelAllowsDesktopAutoUpdate('cli-npm')).toBe(false)
  })

  it('only CLI auto-updates via npm', () => {
    expect(channelAllowsNpmAutoUpdate('cli-npm')).toBe(true)
    expect(channelAllowsNpmAutoUpdate('desktop-packaged')).toBe(false)
  })
})
