import { describe, expect, it } from 'vitest'
import {
  canBuildOnHost,
  hostPlatform,
  parsePlatformFlag,
  electronBuilderPlatformArgs
} from './platform'

describe('platform helpers', () => {
  it('parsePlatformFlag maps aliases', () => {
    expect(parsePlatformFlag('darwin')).toBe('mac')
    expect(parsePlatformFlag('windows')).toBe('win')
    expect(parsePlatformFlag('ubuntu')).toBe('linux')
    expect(parsePlatformFlag('current')).toBe(hostPlatform())
  })

  it('canBuildOnHost blocks mac installer on non-mac without force', () => {
    if (hostPlatform() !== 'mac') {
      const g = canBuildOnHost('mac', 'installer', false)
      expect(g.ok).toBe(false)
      expect(canBuildOnHost('mac', 'installer', true).ok).toBe(true)
    } else {
      expect(canBuildOnHost('mac', 'dir', false).ok).toBe(true)
    }
  })

  it('electronBuilderPlatformArgs', () => {
    expect(electronBuilderPlatformArgs('linux')).toEqual(['--linux'])
    expect(electronBuilderPlatformArgs('win')).toEqual(['--win'])
    expect(electronBuilderPlatformArgs('mac')).toEqual(['--mac'])
  })
})
