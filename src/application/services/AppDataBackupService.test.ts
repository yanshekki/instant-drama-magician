import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import {
  FULL_BACKUP_KIND,
  parseFullBackupManifest,
  settingsPayloadForBackup,
  AppDataBackupService,
  defaultFullBackupFileName
} from './AppDataBackupService'
import type { AppSettings } from '../../types/settings'
import { DEFAULT_SETTINGS } from '../../types/settings'
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  existsSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import JSZip from 'jszip'

describe('AppDataBackupService helpers', () => {
  it('parses a valid full-backup manifest', () => {
    const m = parseFullBackupManifest({
      version: 1,
      kind: FULL_BACKUP_KIND,
      appVersion: '1.0.0',
      platform: 'linux',
      exportedAt: '2026-01-01T00:00:00.000Z',
      includeSecrets: false,
      includeLogs: true,
      databaseBasename: 'instant-drama.db'
    })
    expect(m.kind).toBe(FULL_BACKUP_KIND)
    expect(m.version).toBe(1)
    expect(m.includeSecrets).toBe(false)
  })

  it('rejects story-style or foreign manifests', () => {
    expect(() =>
      parseFullBackupManifest({
        version: 2,
        kind: 'story',
        storyId: 'x'
      })
    ).toThrow(/errors\.backupWrongKind/)
  })

  it('rejects invalid raw / version', () => {
    expect(() => parseFullBackupManifest(null)).toThrow()
    expect(() =>
      parseFullBackupManifest({ kind: FULL_BACKUP_KIND, version: 0 })
    ).toThrow(/errors\.backupUnsupportedVersion/)
  })

  it('redacts secrets by default for export payload', () => {
    const settings: AppSettings = {
      ...DEFAULT_SETTINGS,
      apiKey: 'secret-key-123',
      ttsHttpUrl: 'http://tts.local'
    }
    const redacted = settingsPayloadForBackup(settings, false)
    expect(redacted.apiKey).toBe('[redacted]')
    expect(redacted.ttsHttpUrl).toBe('[set]')

    const full = settingsPayloadForBackup(settings, true)
    expect(full.apiKey).toBe('secret-key-123')
  })

  it('defaultFullBackupFileName has stamp', () => {
    expect(defaultFullBackupFileName()).toMatch(/^idm-full-backup-/)
  })
})

describe('AppDataBackupService export/import', () => {
  let root: string

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'idm-fullbak-'))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  function makePaths(overrides: Partial<ConstructorParameters<typeof AppDataBackupService>[0]> = {}) {
    const userData = join(root, 'user')
    const mediaRoot = join(userData, 'media')
    mkdirSync(mediaRoot, { recursive: true })
    mkdirSync(join(userData, 'logs'), { recursive: true })
    const databasePath = join(userData, 'instant-drama.db')
    writeFileSync(databasePath, Buffer.alloc(100, 1))
    writeFileSync(databasePath + '-wal', Buffer.from('wal'))
    const settingsPath = join(userData, 'settings.json')
    writeFileSync(
      settingsPath,
      JSON.stringify({ ...DEFAULT_SETTINGS, apiKey: 'k' })
    )
    writeFileSync(join(mediaRoot, 'a.png'), 'img')
    mkdirSync(join(mediaRoot, 'tmp'), { recursive: true })
    writeFileSync(join(mediaRoot, 'tmp', 't.png'), 'tmp')
    const activityLogPath = join(userData, 'logs', 'activity.jsonl')
    writeFileSync(activityLogPath, '{"e":1}\n')
    return {
      userData,
      databasePath,
      settingsPath,
      mediaRoot,
      activityLogPath,
      appVersion: '1.2.0',
      platform: 'linux',
      ...overrides
    }
  }

  it('exportToZip includes db settings media logs and skips tmp', async () => {
    const paths = makePaths()
    const svc = new AppDataBackupService(paths)
    const zipPath = join(root, 'out.zip')
    const { manifest, filePath } = await svc.exportToZip(zipPath, {
      includeSecrets: false,
      includeLogs: true,
      skipMediaTmp: true
    })
    expect(filePath).toBe(zipPath)
    expect(manifest.kind).toBe(FULL_BACKUP_KIND)
    expect(manifest.mediaSkipped?.some((p) => p.startsWith('tmp'))).toBe(true)
    const zip = await JSZip.loadAsync(readFileSync(zipPath))
    expect(zip.file('database.db')).toBeTruthy()
    expect(zip.file('database.db-wal')).toBeTruthy()
    expect(zip.file('settings.json')).toBeTruthy()
    expect(zip.file('media/a.png')).toBeTruthy()
    expect(zip.file('logs/activity.jsonl')).toBeTruthy()
    const settings = JSON.parse(await zip.file('settings.json')!.async('string'))
    expect(settings.apiKey).toBe('[redacted]')
  })

  it('exportToZip throws when database missing', async () => {
    const paths = makePaths()
    rmSync(paths.databasePath)
    const svc = new AppDataBackupService(paths)
    await expect(svc.exportToZip(join(root, 'x.zip'))).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })
  })

  it('exportToZip with invalid settings falls back to raw copy', async () => {
    const paths = makePaths()
    writeFileSync(paths.settingsPath, 'not-json{')
    const svc = new AppDataBackupService(paths)
    const zipPath = join(root, 'raw.zip')
    await svc.exportToZip(zipPath, { includeLogs: false })
    const zip = await JSZip.loadAsync(readFileSync(zipPath))
    expect(await zip.file('settings.json')!.async('string')).toContain('not-json')
    expect(zip.file('logs/activity.jsonl')).toBeNull()
  })

  it('exportToZip includeSecrets keeps apiKey', async () => {
    const paths = makePaths()
    const svc = new AppDataBackupService(paths)
    const zipPath = join(root, 'sec.zip')
    await svc.exportToZip(zipPath, { includeSecrets: true })
    const zip = await JSZip.loadAsync(readFileSync(zipPath))
    const settings = JSON.parse(await zip.file('settings.json')!.async('string'))
    expect(settings.apiKey).toBe('k')
  })

  it('importFromZip restores database settings media logs', async () => {
    const paths = makePaths()
    const svc = new AppDataBackupService(paths)
    const zipPath = join(root, 'full.zip')
    await svc.exportToZip(zipPath)

    // wipe live data
    writeFileSync(paths.databasePath, Buffer.alloc(10, 9))
    writeFileSync(paths.settingsPath, '{}')
    rmSync(join(paths.mediaRoot, 'a.png'))
    writeFileSync(paths.activityLogPath, '')

    const result = await svc.importFromZip(zipPath)
    expect(result.restoredDatabase).toBe(true)
    expect(result.restoredSettings).toBe(true)
    expect(result.restoredMedia).toBe(true)
    expect(result.restoredLogs).toBe(true)
    expect(existsSync(join(paths.mediaRoot, 'a.png'))).toBe(true)
    expect(readFileSync(paths.databasePath).length).toBe(100)
  })

  it('importFromZip missing zip / manifest / db', async () => {
    const paths = makePaths()
    const svc = new AppDataBackupService(paths)
    await expect(svc.importFromZip(join(root, 'no.zip'))).rejects.toMatchObject({
      code: 'NOT_FOUND'
    })

    const zip = new JSZip()
    zip.file('readme.txt', 'hi')
    const badPath = join(root, 'bad.zip')
    writeFileSync(badPath, await zip.generateAsync({ type: 'nodebuffer' }))
    await expect(svc.importFromZip(badPath)).rejects.toMatchObject({
      code: 'VALIDATION'
    })

    const zip2 = new JSZip()
    zip2.file(
      'manifest.json',
      JSON.stringify({
        version: 1,
        kind: FULL_BACKUP_KIND,
        appVersion: '1',
        platform: 'linux',
        exportedAt: '',
        includeSecrets: false,
        includeLogs: false,
        databaseBasename: 'x.db'
      })
    )
    // skip path traversal entries
    zip2.file('../evil.txt', 'x')
    zip2.file('/abs.txt', 'x')
    const noDb = join(root, 'nodb.zip')
    writeFileSync(noDb, await zip2.generateAsync({ type: 'nodebuffer' }))
    await expect(svc.importFromZip(noDb)).rejects.toMatchObject({
      code: 'VALIDATION'
    })
  })

  it('importFromZip restores sidecars', async () => {
    const paths = makePaths()
    const svc = new AppDataBackupService(paths)
    const zipPath = join(root, 'side.zip')
    await svc.exportToZip(zipPath)
    // ensure old sidecars removed/replaced
    writeFileSync(paths.databasePath + '-journal', 'old')
    const r = await svc.importFromZip(zipPath)
    expect(r.restoredDatabase).toBe(true)
    expect(existsSync(paths.databasePath + '-wal')).toBe(true)
  })

  it('exportToZip with no media root and no settings still works', async () => {
    const userData = join(root, 'minimal')
    mkdirSync(userData, { recursive: true })
    const databasePath = join(userData, 'db.sqlite')
    writeFileSync(databasePath, Buffer.alloc(20, 2))
    const svc = new AppDataBackupService({
      userData,
      databasePath,
      settingsPath: join(userData, 'missing-settings.json'),
      mediaRoot: join(userData, 'no-media'),
      activityLogPath: join(userData, 'no-log.jsonl'),
      appVersion: '0.0.1',
      platform: 'linux'
    })
    const zipPath = join(root, 'min.zip')
    const { manifest } = await svc.exportToZip(zipPath, { includeLogs: true })
    expect(manifest.databaseBasename).toBe('db.sqlite')
  })
})
