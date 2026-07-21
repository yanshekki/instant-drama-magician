import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { resolveAppPaths } from '../../domain/appPaths'
import {
  migrateAppDataIfNeeded,
  MIGRATION_MARKER_FILE
} from './AppDataMigrationService'

describe('AppDataMigrationService', () => {
  let root: string
  let cwd: string

  beforeEach(() => {
    root = join(
      tmpdir(),
      `idm-mig-${Date.now()}-${Math.random().toString(36).slice(2)}`
    )
    cwd = join(root, 'repo')
    mkdirSync(join(cwd, 'prisma'), { recursive: true })
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it('copies prisma/dev.db into dataRoot when dest empty', () => {
    const legacyDb = join(cwd, 'prisma', 'dev.db')
    writeFileSync(legacyDb, Buffer.alloc(60_000, 1))

    const paths = resolveAppPaths({
      dataDir: join(root, 'target'),
      isDevRuntime: true
    })

    const r = migrateAppDataIfNeeded({ paths, cwd })
    expect(r.ran).toBe(true)
    expect(existsSync(paths.databasePath)).toBe(true)
    expect(readFileSync(paths.databasePath).length).toBeGreaterThan(50_000)
    expect(existsSync(join(paths.dataRoot, MIGRATION_MARKER_FILE))).toBe(true)

    const r2 = migrateAppDataIfNeeded({ paths, cwd })
    expect(r2.actions.some((a) => a.includes('already migrated'))).toBe(true)
  })

  it('merges db+media+settings from legacy CLI idm root', () => {
    const xdgData = join(root, 'share')
    const idm = join(xdgData, 'idm')
    mkdirSync(join(idm, 'media'), { recursive: true })
    writeFileSync(join(idm, 'media', 'b.png'), 'x')
    writeFileSync(join(idm, 'instant-drama.db'), Buffer.alloc(60_000, 2))
    writeFileSync(join(idm, 'settings.json'), JSON.stringify({ uiLanguage: 'en' }))

    const paths = resolveAppPaths({
      dataDir: join(root, 'target3'),
      isDevRuntime: false
    })

    const r = migrateAppDataIfNeeded({
      paths,
      cwd,
      home: root,
      env: { XDG_DATA_HOME: xdgData, XDG_CONFIG_HOME: join(root, 'cfg') },
      platform: 'linux'
    })

    expect(r.ran).toBe(true)
    expect(existsSync(paths.databasePath)).toBe(true)
    expect(existsSync(join(paths.mediaRoot, 'b.png'))).toBe(true)
    expect(existsSync(paths.settingsPath)).toBe(true)
  })

  it('does not overwrite existing dest db', () => {
    const legacyDb = join(cwd, 'prisma', 'dev.db')
    writeFileSync(legacyDb, Buffer.alloc(60_000, 9))

    const paths = resolveAppPaths({ dataDir: join(root, 'keep') })
    mkdirSync(paths.dataRoot, { recursive: true })
    writeFileSync(paths.databasePath, Buffer.alloc(80_000, 7))

    migrateAppDataIfNeeded({ paths, cwd })
    expect(readFileSync(paths.databasePath)[0]).toBe(7)
  })
})
