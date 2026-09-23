import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AppUpdateService } from './AppUpdateService'

describe('AppUpdateService', () => {
  it('starts with no update', () => {
    const service = new AppUpdateService()
    expect(service.snapshot().status).toBe('none')
    expect(service.snapshot().available).toBe(false)
  })

  it('is disabled in dev', () => {
    const service = new AppUpdateService()
    expect(service.snapshot().status).toBe('none')
  })
})

describe('installer artifactName', () => {
  it('keeps stable filenames for electron-updater', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      build: {
        appImage?: { artifactName?: string }
        nsis?: { artifactName?: string }
        dmg?: { artifactName?: string }
      }
    }
    expect(pkg.build.appImage?.artifactName).toBe('InstantDrama-Magician-${version}.${ext}')
    expect(pkg.build.nsis?.artifactName).toBe('InstantDrama-Magician-Setup-${version}.${ext}')
    expect(pkg.build.dmg?.artifactName).toBe('InstantDrama-Magician-${version}-${arch}.${ext}')
  })

  it('keeps mac ad-hoc signing on and Developer ID discovery off', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf8')) as {
      build: {
        afterPack?: string
        mac?: { identity?: string | null }
      }
    }
    expect(pkg.build.afterPack).toBe('scripts/adhoc-sign-mac.cjs')
    expect(pkg.build.mac?.identity).toBeNull()
  })
})
