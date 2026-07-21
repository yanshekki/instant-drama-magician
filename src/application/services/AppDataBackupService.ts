/**
 * Full application data backup / restore (DB + media + settings + optional logs).
 * Distinct from ProjectBackupService (single-story zip).
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from 'fs'
import { basename, dirname, join, relative, sep } from 'path'
import JSZip from 'jszip'
import { AppError } from '../../types/errors'
import { redactSettings } from '../../infrastructure/support/SupportReport'
import type { AppSettings } from '../../types/settings'

export const FULL_BACKUP_VERSION = 1
export const FULL_BACKUP_KIND = 'full-app-data' as const

export interface FullBackupManifest {
  version: number
  kind: typeof FULL_BACKUP_KIND
  appVersion: string
  platform: string
  exportedAt: string
  includeSecrets: boolean
  includeLogs: boolean
  /** Original basename of the SQLite file at export time */
  databaseBasename: string
  /** Relative paths included under media/ */
  mediaSkipped?: string[]
}

export interface AppDataBackupPaths {
  userData: string
  /** Absolute path to the live SQLite file */
  databasePath: string
  settingsPath: string
  mediaRoot: string
  activityLogPath: string
  appVersion: string
  platform: string
}

export interface ExportFullOptions {
  includeSecrets?: boolean
  includeLogs?: boolean
  /** Skip media/tmp (default true) */
  skipMediaTmp?: boolean
}

export interface ImportFullResult {
  manifest: FullBackupManifest
  restoredDatabase: boolean
  restoredSettings: boolean
  restoredMedia: boolean
  restoredLogs: boolean
}

function walkFiles(dir: string, base = dir): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    let st
    try {
      st = statSync(full)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      out.push(...walkFiles(full, base))
    } else if (st.isFile()) {
      out.push(full)
    }
  }
  return out
}

function relPosix(from: string, to: string): string {
  return relative(from, to).split(sep).join('/')
}

function ensureParent(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true })
}

/** Copy SQLite main + sidecar WAL/SHM if present. */
function sqliteSidecars(dbPath: string): string[] {
  const files = [dbPath]
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const p = dbPath + suffix
    if (existsSync(p)) files.push(p)
  }
  return files
}

export function parseFullBackupManifest(raw: unknown): FullBackupManifest {
  if (!raw || typeof raw !== 'object') {
    throw new AppError('VALIDATION', 'errors.backupInvalidManifest')
  }
  const m = raw as Record<string, unknown>
  if (m.kind !== FULL_BACKUP_KIND) {
    throw new AppError(
      'VALIDATION',
      'errors.backupWrongKind'
    )
  }
  if (typeof m.version !== 'number' || m.version < 1) {
    throw new AppError('VALIDATION', 'errors.backupUnsupportedVersion')
  }
  return {
    version: m.version as number,
    kind: FULL_BACKUP_KIND,
    appVersion: String(m.appVersion ?? 'unknown'),
    platform: String(m.platform ?? 'unknown'),
    exportedAt: String(m.exportedAt ?? ''),
    includeSecrets: Boolean(m.includeSecrets),
    includeLogs: Boolean(m.includeLogs),
    databaseBasename: String(m.databaseBasename ?? 'database.db'),
    mediaSkipped: Array.isArray(m.mediaSkipped)
      ? (m.mediaSkipped as string[])
      : undefined
  }
}

export function settingsPayloadForBackup(
  settings: AppSettings,
  includeSecrets: boolean
): Record<string, unknown> {
  if (includeSecrets) {
    return { ...settings }
  }
  return redactSettings(settings)
}

export class AppDataBackupService {
  constructor(private readonly paths: AppDataBackupPaths) {}

  async exportToZip(
    zipPath: string,
    options: ExportFullOptions = {}
  ): Promise<{ filePath: string; manifest: FullBackupManifest }> {
    const includeSecrets = options.includeSecrets === true
    const includeLogs = options.includeLogs !== false
    const skipMediaTmp = options.skipMediaTmp !== false

    if (!existsSync(this.paths.databasePath)) {
      throw new AppError(
        'NOT_FOUND',
        'errors.databaseNotFound',
        String(this.paths.databasePath)
      )
    }

    const zip = new JSZip()
    const mediaSkipped: string[] = []

    // Database → database.db (+ sidecars)
    const dbFiles = sqliteSidecars(this.paths.databasePath)
    for (const f of dbFiles) {
      const name =
        f === this.paths.databasePath
          ? 'database.db'
          : `database.db${f.slice(this.paths.databasePath.length)}`
      zip.file(name, readFileSync(f))
    }

    // Settings
    if (existsSync(this.paths.settingsPath)) {
      try {
        const raw = JSON.parse(
          readFileSync(this.paths.settingsPath, 'utf-8')
        ) as AppSettings
        const payload = settingsPayloadForBackup(raw, includeSecrets)
        zip.file('settings.json', JSON.stringify(payload, null, 2))
      } catch {
        zip.file(
          'settings.json',
          readFileSync(this.paths.settingsPath, 'utf-8')
        )
      }
    }

    // Media tree
    if (existsSync(this.paths.mediaRoot)) {
      const files = walkFiles(this.paths.mediaRoot)
      for (const abs of files) {
        const rel = relPosix(this.paths.mediaRoot, abs)
        if (skipMediaTmp && (rel === 'tmp' || rel.startsWith('tmp/'))) {
          mediaSkipped.push(rel)
          continue
        }
        zip.file(`media/${rel}`, readFileSync(abs))
      }
    }

    // Activity log
    if (includeLogs && existsSync(this.paths.activityLogPath)) {
      zip.file(
        'logs/activity.jsonl',
        readFileSync(this.paths.activityLogPath)
      )
    }

    const manifest: FullBackupManifest = {
      version: FULL_BACKUP_VERSION,
      kind: FULL_BACKUP_KIND,
      appVersion: this.paths.appVersion,
      platform: this.paths.platform,
      exportedAt: new Date().toISOString(),
      includeSecrets,
      includeLogs,
      databaseBasename: basename(this.paths.databasePath),
      mediaSkipped: mediaSkipped.length ? mediaSkipped.slice(0, 50) : undefined
    }
    zip.file('manifest.json', JSON.stringify(manifest, null, 2))

    const buf = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    })
    ensureParent(zipPath)
    writeFileSync(zipPath, buf)
    return { filePath: zipPath, manifest }
  }

  /**
   * Restore from zip onto live paths. Caller must disconnect Prisma first.
   * Does not relaunch — caller should app.relaunch().
   */
  async importFromZip(zipPath: string): Promise<ImportFullResult> {
    if (!existsSync(zipPath)) {
      throw new AppError('NOT_FOUND', 'errors.backupZipNotFound')
    }
    const data = readFileSync(zipPath)
    const zip = await JSZip.loadAsync(data)
    const manifestEntry = zip.file('manifest.json')
    if (!manifestEntry) {
      throw new AppError('VALIDATION', 'errors.backupMissingManifest')
    }
    const manifest = parseFullBackupManifest(
      JSON.parse(await manifestEntry.async('string'))
    )

    // Staging dir under userData
    const staging = join(
      this.paths.userData,
      'tmp',
      `restore-${Date.now()}`
    )
    mkdirSync(staging, { recursive: true })

    let restoredDatabase = false
    let restoredSettings = false
    let restoredMedia = false
    let restoredLogs = false

    try {
      // Extract relevant entries to staging
      const names = Object.keys(zip.files)
      for (const name of names) {
        const entry = zip.files[name]
        if (!entry || entry.dir) continue
        // Security: no absolute / path traversal
        if (name.includes('..') || name.startsWith('/') || name.startsWith('\\')) {
          continue
        }
        const dest = join(staging, name)
        ensureParent(dest)
        const content = await entry.async('nodebuffer')
        writeFileSync(dest, content)
      }

      // Database
      const stagedDb = join(staging, 'database.db')
      if (existsSync(stagedDb)) {
        ensureParent(this.paths.databasePath)
        // Remove old sidecars so restore is clean
        for (const f of sqliteSidecars(this.paths.databasePath)) {
          try {
            if (existsSync(f)) rmSync(f)
          } catch {
            /* ignore */
          }
        }
        copyFileSync(stagedDb, this.paths.databasePath)
        for (const suffix of ['-wal', '-shm', '-journal']) {
          const side = join(staging, `database.db${suffix}`)
          if (existsSync(side)) {
            copyFileSync(side, this.paths.databasePath + suffix)
          }
        }
        restoredDatabase = true
      }

      // Settings
      const stagedSettings = join(staging, 'settings.json')
      if (existsSync(stagedSettings)) {
        ensureParent(this.paths.settingsPath)
        copyFileSync(stagedSettings, this.paths.settingsPath)
        restoredSettings = true
      }

      // Media — merge/replace tree
      const stagedMedia = join(staging, 'media')
      if (existsSync(stagedMedia)) {
        mkdirSync(this.paths.mediaRoot, { recursive: true })
        const files = walkFiles(stagedMedia)
        for (const abs of files) {
          const rel = relative(stagedMedia, abs)
          const dest = join(this.paths.mediaRoot, rel)
          // path traversal guard
          const root = this.paths.mediaRoot
          if (!dest.startsWith(root + sep) && dest !== root) continue
          ensureParent(dest)
          copyFileSync(abs, dest)
        }
        restoredMedia = files.length > 0
      }

      // Logs
      const stagedLog = join(staging, 'logs', 'activity.jsonl')
      if (existsSync(stagedLog)) {
        ensureParent(this.paths.activityLogPath)
        copyFileSync(stagedLog, this.paths.activityLogPath)
        restoredLogs = true
      }

      if (!restoredDatabase) {
        throw new AppError('VALIDATION', 'errors.backupMissingDb')
      }

      return {
        manifest,
        restoredDatabase,
        restoredSettings,
        restoredMedia,
        restoredLogs
      }
    } finally {
      try {
        rmSync(staging, { recursive: true, force: true })
      } catch {
        /* ignore */
      }
    }
  }
}

export function defaultFullBackupFileName(): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `idm-full-backup-${stamp}.zip`
}
