import { describe, expect, it } from 'vitest'
import { homedir } from 'os'
import { join } from 'path'
import {
  APP_ID,
  appFolderName,
  fileUrlToPath,
  fromPrismaSqliteUrl,
  isAbsoluteFsPath,
  legacyDataCandidates,
  normalizePrismaSqliteUrl,
  pathToFileUrl,
  resolveAppPaths,
  toPrismaSqliteUrl,
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

  it('dev and packaged share the default profile unless IDM_PROFILE is set', () => {
    expect(resolveProfile({ isDevRuntime: true, env: {} })).toBe('default')
    expect(resolveProfile({ isDevRuntime: false, env: {} })).toBe('default')
    expect(
      resolveProfile({ isDevRuntime: true, env: { IDM_PROFILE: 'dev' } })
    ).toBe('dev')
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
    expect(p.dataRoot).toBe(join(home, '.config', APP_ID))
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

  it('Windows Prisma URL is file:C:/ not file:///C:/ (SQLITE_CANTOPEN)', () => {
    const winDb =
      'C:\\Users\\ki\\AppData\\Roaming\\instant-drama-magician\\instant-drama.db'
    const u = pathToFileUrl(winDb)
    expect(u).toBe(
      'file:C:/Users/ki/AppData/Roaming/instant-drama-magician/instant-drama.db'
    )
    expect(u.startsWith('file:///')).toBe(false)
    expect(u.startsWith('file:/C:')).toBe(false)
  })

  it('windows packaged paths use Prisma-safe file URL', () => {
    const p = resolveAppPaths({
      isDevRuntime: false,
      platform: 'win32',
      home: 'C:\\Users\\ki',
      env: { APPDATA: 'C:\\Users\\ki\\AppData\\Roaming' }
    })
    expect(p.databaseUrl.replace(/\\/g, '/')).toBe(
      'file:C:/Users/ki/AppData/Roaming/instant-drama-magician/instant-drama.db'
    )
    expect(p.databaseUrl.startsWith('file:///')).toBe(false)
  })

  it('fileUrlToPath round-trips unix and Windows forms', () => {
    expect(fileUrlToPath('file:/tmp/foo.db')).toBe('/tmp/foo.db')
    expect(fileUrlToPath('file:///tmp/foo.db')).toBe('/tmp/foo.db')
    expect(fileUrlToPath('file:////tmp/foo.db')).toBe('/tmp/foo.db')
    expect(fileUrlToPath('file://localhost/tmp/x.sqlite')).toBe('/tmp/x.sqlite')
    expect(fileUrlToPath('file://hostname/tmp/db.sqlite')).toBe('/tmp/db.sqlite')
    expect(fileUrlToPath('file:C:/Users/ki/x.db')).toBe('C:/Users/ki/x.db')
    expect(fileUrlToPath('file:C:\\Users\\ki\\x.db')).toBe('C:\\Users\\ki\\x.db')
    expect(fileUrlToPath('file:///C:/Users/ki/x.db')).toBe('C:/Users/ki/x.db')
    expect(fileUrlToPath('file:/C:/Users/ki/x.db')).toBe('C:/Users/ki/x.db')
    expect(fileUrlToPath('file://localhost/C:/Users/ki/x.db')).toBe(
      'C:/Users/ki/x.db'
    )
    expect(fileUrlToPath('./rel.db')).toBe('./rel.db')
    expect(fileUrlToPath('file:./rel.db')).toBe('./rel.db')
  })

  it('normalizePrismaSqliteUrl rewrites Windows CANTOPEN forms', () => {
    expect(normalizePrismaSqliteUrl('file:///C:/Users/ki/x.db')).toBe(
      'file:C:/Users/ki/x.db'
    )
    expect(normalizePrismaSqliteUrl('file:/C:/Users/ki/x.db')).toBe(
      'file:C:/Users/ki/x.db'
    )
    expect(normalizePrismaSqliteUrl('file:C:/Users/ki/x.db')).toBe(
      'file:C:/Users/ki/x.db'
    )
    expect(normalizePrismaSqliteUrl('file:C:\\Users\\ki\\x.db')).toBe(
      'file:C:/Users/ki/x.db'
    )
    expect(normalizePrismaSqliteUrl('file:///tmp/foo.db')).toBe(
      'file:/tmp/foo.db'
    )
    expect(normalizePrismaSqliteUrl('postgres://h/db')).toBe('postgres://h/db')
    expect(isAbsoluteFsPath('C:/Users/ki/x.db')).toBe(true)
    expect(isAbsoluteFsPath('/tmp/foo.db')).toBe(true)
    expect(isAbsoluteFsPath('./rel.db')).toBe(false)
  })

  it('does not percent-encode spaces or CJK (macOS Application Support / Windows users)', () => {
    const mac = pathToFileUrl(
      '/Users/ki/Library/Application Support/instant-drama-magician/instant-drama.db'
    )
    expect(mac).toBe(
      'file:/Users/ki/Library/Application Support/instant-drama-magician/instant-drama.db'
    )
    expect(mac).not.toContain('%20')
    const winSpace = pathToFileUrl(
      'C:\\Users\\Jane Doe\\AppData\\Roaming\\instant-drama-magician\\instant-drama.db'
    )
    expect(winSpace).toBe(
      'file:C:/Users/Jane Doe/AppData/Roaming/instant-drama-magician/instant-drama.db'
    )
    expect(winSpace).not.toContain('%20')
    const winCjk = pathToFileUrl(
      'C:\\Users\\王小明\\AppData\\Roaming\\instant-drama-magician\\instant-drama.db'
    )
    expect(winCjk).toBe(
      'file:C:/Users/王小明/AppData/Roaming/instant-drama-magician/instant-drama.db'
    )
    expect(
      normalizePrismaSqliteUrl(
        'file:///C:/Users/Jane Doe/AppData/Roaming/instant-drama-magician/instant-drama.db'
      )
    ).toBe(
      'file:C:/Users/Jane Doe/AppData/Roaming/instant-drama-magician/instant-drama.db'
    )
    const macPack = resolveAppPaths({
      isDevRuntime: false,
      platform: 'darwin',
      home: '/Users/ki',
      env: {}
    })
    expect(macPack.databaseUrl).toContain('Application Support')
    expect(macPack.databaseUrl).not.toContain('%20')
  })

  it('fileUrlToPath strips query and hash', () => {
    expect(fileUrlToPath('file:/tmp/foo.db?connection_limit=1')).toBe(
      '/tmp/foo.db'
    )
    expect(
      fileUrlToPath('file:C:/Users/ki/x.db?connection_limit=1#frag')
    ).toBe('C:/Users/ki/x.db')
    expect(
      normalizePrismaSqliteUrl('file:///tmp/foo.db?socket_timeout=10')
    ).toBe('file:/tmp/foo.db')
    expect(toPrismaSqliteUrl).toBe(pathToFileUrl)
    expect(fromPrismaSqliteUrl).toBe(fileUrlToPath)
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
