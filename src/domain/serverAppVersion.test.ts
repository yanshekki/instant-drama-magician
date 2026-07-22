import { describe, expect, it } from 'vitest'
import { resolve } from 'path'
import { resolveServerAppVersion } from './serverAppVersion'

describe('resolveServerAppVersion', () => {
  it('prefers npm_package_version / envVersion', () => {
    expect(
      resolveServerAppVersion({ envVersion: ' 9.9.9 ', cwd: '/no/such' })
    ).toBe('9.9.9')
  })

  it('reads package.json from cwd when env empty', () => {
    const v = resolveServerAppVersion({
      envVersion: '',
      cwd: process.cwd()
    })
    expect(v).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('can require from server entry path', () => {
    const v = resolveServerAppVersion({
      envVersion: null,
      requireFrom: resolve(process.cwd(), 'server/index.ts')
    })
    expect(v).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('falls back to 1.0.0 when nothing resolves', () => {
    expect(
      resolveServerAppVersion({
        envVersion: '  ',
        cwd: '/tmp/idm-no-pkg-here-xyz',
        requireFrom: '/tmp/idm-no-pkg-here-xyz/x.js'
      })
    ).toBe('1.0.0')
  })
})
