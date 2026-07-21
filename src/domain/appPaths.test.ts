import { describe, expect, it } from 'vitest'
import { homedir } from 'os'
import { join } from 'path'
import {
  APP_ID,
  appFolderName,
  legacyDataCandidates,
  pathToFileUrl,
  resolveAppPaths,
  resolveDataRoot,
  resolveOsAppDataBase,
  resolveProfile
} from './appPaths'

describe('appPaths', () => {
  const home = '/home/tester'

  it('resolves Linux base under XDG_CONFIG_HOME', () => {
    const base = resolveOsAppDataBase({
      platform: 'linux',
      home,
      env: { XDG_CONFIG_HOME: '/xdg/cfg' }
    })
    expect(base).toBe('/xdg/cfg')
  })

  it('resolves Linux default ~/.config', () => {
    expect(
      resolveOsAppDataBase({ platform: 'linux', home, env: {} })
    ).toBe(join(home, '.config'))
  })

  it('resolves macOS Application Support', () => {
    expect(
      resolveOsAppDataBase({ platform: 'darwin', home: '/Users/ki', env: {} })
    ).toBe('/Users/ki/Library/Application Support')
  })

  it('resolves Windows APPDATA', () => {
    expect(
      resolveOsAppDataBase({
        platform: 'win32',
        home: 'C:\\Users\\ki',
        env: { APPDATA: 'C:\\Users\\ki\\AppData\\Roaming' }
      })
    ).toBe('C:\\Users\\ki\\AppData\\Roaming')
  })

  it('appFolderName encodes profiles', () => {
    expect(appFolderName('default')).toBe(APP_ID)
    expect(appFolderName('dev')).toBe(`${APP_ID}-dev`)
    expect(appFolderName('staging')).toBe(`${APP_ID}-staging`)
  })

  it('dev runtime defaults to dev profile', () => {
    expect(resolveProfile({ isDevRuntime: true, env: {} })).toBe('dev')
    expect(resolveProfile({ isDevRuntime: false, env: {} })).toBe('default')
    expect(
      resolveProfile({ isDevRuntime: true, env: { IDM_PROFILE: 'default' } })
    ).toBe('default')
  })

  it('IDM_DATA_DIR wins and marks override', () => {
    const r = resolveDataRoot({
      envDataDir: '/portable/idm-data',
      isDevRuntime: true,
      platform: 'linux',
      home,
      env: {}
    })
    expect(r.isOverride).toBe(true)
    expect(r.dataRoot).toBe('/portable/idm-data')
  })

  it('layout puts db+media under same dataRoot (linux dev)', () => {
    const p = resolveAppPaths({
      isDevRuntime: true,
      platform: 'linux',
      home,
      env: {}
    })
    expect(p.dataRoot).toBe(join(home, '.config', `${APP_ID}-dev`))
    expect(p.databasePath).toBe(join(p.dataRoot, 'instant-drama.db'))
    expect(p.mediaRoot).toBe(join(p.dataRoot, 'media'))
    expect(p.settingsPath).toBe(join(p.dataRoot, 'settings.json'))
    expect(p.databaseUrl).toContain(p.databasePath)
    expect(p.databaseUrl.startsWith('file:')).toBe(true)
  })

  it('packaged default is not -dev', () => {
    const p = resolveAppPaths({
      isDevRuntime: false,
      platform: 'linux',
      home,
      env: {}
    })
    expect(p.dataRoot).toBe(join(home, '.config', APP_ID))
    expect(p.profile).toBe('default')
  })

  it('mac packaged paths', () => {
    const p = resolveAppPaths({
      isDevRuntime: false,
      platform: 'darwin',
      home: '/Users/ki',
      env: {}
    })
    expect(p.dataRoot).toBe(
      '/Users/ki/Library/Application Support/instant-drama-magician'
    )
  })

  it('pathToFileUrl is absolute file URL', () => {
    const u = pathToFileUrl('/tmp/foo/instant-drama.db')
    expect(u).toBe('file:/tmp/foo/instant-drama.db')
  })

  it('legacy candidates include prisma/dev.db and idm share', () => {
    const leg = legacyDataCandidates({
      home,
      cwd: '/repo',
      env: {},
      platform: 'linux'
    })
    expect(leg.databases).toContain('/repo/prisma/dev.db')
    expect(leg.roots.some((r) => r.endsWith('/.local/share/idm'))).toBe(true)
  })

  it('real homedir resolves without throw', () => {
    const p = resolveAppPaths({ isDevRuntime: false })
    expect(p.dataRoot.includes(homedir()) || p.dataRoot.length > 0).toBe(true)
  })
})
