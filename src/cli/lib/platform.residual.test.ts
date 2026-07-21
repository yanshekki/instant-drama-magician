import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  hostArch,
  canBuildOnHost,
  electronBuilderPlatformArgs,
  electronBuilderInstallerTargets,
  parsePlatformFlag,
  hostPlatform
} from './platform'

describe('platform residual 100%', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('hostArch returns raw arch for unusual values', () => {
    const desc = Object.getOwnPropertyDescriptor(process, 'arch')
    Object.defineProperty(process, 'arch', { value: 'mips', configurable: true })
    expect(hostArch()).toBe('mips')
    if (desc) Object.defineProperty(process, 'arch', desc)
  })

  it('canBuildOnHost cross installer and dir rejections + final ok', () => {
    // installer mac from linux already covered; need installer win from mac or linux→mac already
    // Cross installer non-win: e.g. linux installer from mac
    const r1 = canBuildOnHost('linux', 'installer', false)
    // if host is linux, platform===host returns ok early
    // Force: mac host building linux installer
    const platDesc = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', {
      value: 'darwin',
      configurable: true
    })
    expect(canBuildOnHost('linux', 'installer', false).ok).toBe(false)
    expect(canBuildOnHost('linux', 'installer', false).reason).toMatch(/Cross-building installers/)
    // dir cross: mac → linux dir
    expect(canBuildOnHost('linux', 'dir', false).ok).toBe(false)
    expect(canBuildOnHost('linux', 'dir', false).reason).toMatch(/dir/)
    // win dir from mac (not linux→win allowed path)
    expect(canBuildOnHost('win', 'dir', false).ok).toBe(false)
    // force true
    expect(canBuildOnHost('linux', 'dir', true).ok).toBe(true)
    // same host
    expect(canBuildOnHost('mac', 'dir', false).ok).toBe(true)
    // final return {ok:true} — win installer from linux is ok:true at line 57-59
    Object.defineProperty(process, 'platform', {
      value: 'linux',
      configurable: true
    })
    expect(canBuildOnHost('win', 'installer', false).ok).toBe(true)
    // win dir from linux ok
    expect(canBuildOnHost('win', 'dir', false).ok).toBe(true)
    // mac from linux fails early
    expect(canBuildOnHost('mac', 'dir', false).ok).toBe(false)
    if (platDesc) Object.defineProperty(process, 'platform', platDesc)
  })

  it('builder args and targets', () => {
    expect(electronBuilderPlatformArgs('mac')).toEqual(['--mac'])
    expect(electronBuilderPlatformArgs('win')).toEqual(['--win'])
    expect(electronBuilderPlatformArgs('linux')).toEqual(['--linux'])
    expect(electronBuilderInstallerTargets('mac')).toContain('dmg')
    expect(electronBuilderInstallerTargets('win')).toContain('nsis')
    expect(electronBuilderInstallerTargets('linux').length).toBeGreaterThan(0)
    expect(parsePlatformFlag(undefined)).toBe(hostPlatform())
  })

  it('bogus target hits final ok return', () => {
    // Runtime path that skips dir/installer gates
    const r = (canBuildOnHost as (p: any, t: any, f?: boolean) => any)(
      'win',
      'nsis',
      false
    )
    // host is linux in CI: platform win !== host, not mac-only fail, not installer/dir gates
    expect(r.ok).toBe(true)
  })


  it('parsePlatformFlag throws on unknown', () => {
    expect(() => parsePlatformFlag('solaris')).toThrow(/Unknown platform/)
    expect(parsePlatformFlag(true)).toBe(hostPlatform())
    expect(parsePlatformFlag('')).toBe(hostPlatform())
    expect(parsePlatformFlag('darwin')).toBe('mac')
    expect(parsePlatformFlag('windows')).toBe('win')
    expect(parsePlatformFlag('ubuntu')).toBe('linux')
  })

})
