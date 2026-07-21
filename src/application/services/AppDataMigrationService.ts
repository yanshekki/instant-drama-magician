/**
 * One-shot, non-destructive migration of legacy data roots into the
 * unified OS data root (see domain/appPaths).
 *
 * Never deletes source paths. Only copies when the destination is empty
 * or missing a usable database.
 */
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  statSync,
  writeFileSync,
  readFileSync
} from 'fs'
import { execFileSync } from 'child_process'
import { basename, dirname, join } from 'path'
import {
  type AppPaths,
  legacyDataCandidates,
  DATABASE_FILE
} from '../../domain/appPaths'

export type MigrationResult = {
  ran: boolean
  actions: string[]
  /** Source → dest copies */
  copied: Array<{ from: string; to: string; kind: 'db' | 'tree-file' }>
}

export type MigrationOptions = {
  paths: AppPaths
  /** Repo cwd for prisma/dev.db discovery */
  cwd?: string
  /** Skip if marker file already present */
  force?: boolean
  /** For tests: override home / env used by legacy discovery */
  home?: string
  env?: NodeJS.ProcessEnv
  platform?: string
}

const MARKER = '.idm-migrated-v1'

/** Exported for unit tests (catch/empty dir branches). */
export function isNonEmptyDir(dir: string): boolean {
  try {
    if (!existsSync(dir) || !statSync(dir).isDirectory()) return false
    return readdirSync(dir).length > 0
  } catch {
    return false
  }
}

/** Exported for unit tests (stat catch / story-count empty). */
export function dbLooksEmpty(dbPath: string): boolean {
  if (!existsSync(dbPath)) return true
  try {
    const size = statSync(dbPath).size
    if (size < 50_000) return true
    // Prefer story-count when possible (better-sqlite not required)
    const n = countStoriesRough(dbPath)
    if (n !== null) return n === 0
    return false
  } catch {
    return true
  }
}

/** Best-effort Story count via `sqlite3` CLI if present; else null. */
function countStoriesRough(dbPath: string): number | null {
  try {
    const out = execFileSync(
      'sqlite3',
      [dbPath, 'SELECT COUNT(*) FROM Story;'],
      { encoding: 'utf8', timeout: 3000 }
    )
    const n = Number(String(out).trim())
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** Exported for unit tests (stat catch → -1). */
export function dbStoryScore(dbPath: string): number {
  if (!existsSync(dbPath)) return -1
  const n = countStoriesRough(dbPath)
  if (n !== null) return n
  try {
    return statSync(dbPath).size
  } catch {
    return -1
  }
}

function ensureDir(p: string): void {
  mkdirSync(p, { recursive: true })
}

function copyFileSafe(from: string, to: string): void {
  ensureDir(dirname(to))
  copyFileSync(from, to)
}

/** Copy directory files one level + recursive media-like trees. */
function copyTree(from: string, to: string, out: MigrationResult['copied']): void {
  if (!existsSync(from) || !statSync(from).isDirectory()) return
  ensureDir(to)
  for (const name of readdirSync(from)) {
    if (name === MARKER || name === '.' || name === '..') continue
    const src = join(from, name)
    const dest = join(to, name)
    let st
    try {
      st = statSync(src)
    } catch {
      continue
    }
    if (st.isDirectory()) {
      copyTree(src, dest, out)
    } else if (st.isFile()) {
      if (existsSync(dest)) continue
      copyFileSafe(src, dest)
      out.push({ from: src, to: dest, kind: 'tree-file' })
    }
  }
}

/**
 * Count Story rows without Prisma (optional better empty check).
 * Uses a tiny SQL parse via sqlite3 CLI if available is overkill —
 * we open with better-sqlite not in deps. Size heuristic is enough.
 */
export function migrateAppDataIfNeeded(
  options: MigrationOptions
): MigrationResult {
  const { paths, force } = options
  const markerPath = join(paths.dataRoot, MARKER)
  const result: MigrationResult = { ran: false, actions: [], copied: [] }

  ensureDir(paths.dataRoot)
  if (!force && existsSync(markerPath)) {
    result.actions.push('skip: already migrated')
    return result
  }

  const destDb = paths.databasePath
  const destEmpty = dbLooksEmpty(destDb)
  const leg = legacyDataCandidates({
    cwd: options.cwd,
    home: options.home,
    env: options.env,
    platform: options.platform
  })

  // 1) Prefer a richer legacy DB when dest is empty OR clearly poorer
  //    (e.g. leftover 0–1 story schema vs prisma/dev.db with full library)
  {
    const destScore = dbStoryScore(destDb)
    let best: { path: string; score: number } | null = null
    for (const db of [
      ...leg.databases,
      ...leg.roots.map((r) => join(r, DATABASE_FILE))
    ]) {
      if (!existsSync(db) || resolveSame(db, destDb)) continue
      const score = dbStoryScore(db)
      if (score <= 0) continue
      if (!best || score > best.score) best = { path: db, score }
    }
    const shouldReplace =
      destEmpty ||
      (best !== null && best.score > destScore && destScore <= 1)
    if (shouldReplace && best) {
      try {
        if (existsSync(destDb)) {
          copyFileSafe(destDb, `${destDb}.bak-before-migrate`)
        }
        copyFileSafe(best.path, destDb)
        result.copied.push({ from: best.path, to: destDb, kind: 'db' })
        result.actions.push(
          `db: adopted richer ${best.path} (score ${best.score} > ${destScore}) → ${destDb}`
        )
      } catch (e) {
        result.actions.push(
          `db: failed ${best.path}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  }

  // 2) If still empty, try instant-drama.db inside legacy roots
  if (dbLooksEmpty(destDb)) {
    for (const root of leg.roots) {
      if (resolveSame(root, paths.dataRoot)) continue
      const candidate = join(root, DATABASE_FILE)
      if (!existsSync(candidate) || dbLooksEmpty(candidate)) continue
      try {
        copyFileSafe(candidate, destDb)
        result.copied.push({ from: candidate, to: destDb, kind: 'db' })
        result.actions.push(`db: copied ${candidate} → ${destDb}`)
        // Also pull media/settings from that root if dest lacks them
        mergeTree(root, paths, result)
        break
      } catch (e) {
        result.actions.push(
          `db: failed ${candidate}: ${e instanceof Error ? e.message : String(e)}`
        )
      }
    }
  }

  // 3) Fill missing media/settings from any legacy root that has them
  for (const root of leg.roots) {
    if (resolveSame(root, paths.dataRoot)) continue
    if (!isNonEmptyDir(root)) continue
    mergeTree(root, paths, result)
  }

  // Marker
  try {
    writeFileSync(
      markerPath,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          dataRoot: paths.dataRoot,
          actions: result.actions,
          copied: result.copied.length
        },
        null,
        2
      ) + '\n',
      'utf8'
    )
    result.ran = true
    result.actions.push('marker: written')
  } catch (e) {
    result.actions.push(
      `marker: failed ${e instanceof Error ? e.message : String(e)}`
    )
  }

  return result
}

/** Exported for unit tests (stat ino/dev catch → string compare). */
export function resolveSame(a: string, b: string): boolean {
  try {
    return (
      existsSync(a) &&
      existsSync(b) &&
      statSync(a).ino === statSync(b).ino &&
      statSync(a).dev === statSync(b).dev
    )
  } catch {
    return a === b
  }
}

function mergeTree(
  root: string,
  paths: AppPaths,
  result: MigrationResult
): void {
  // settings
  const settingsSrc = join(root, 'settings.json')
  if (existsSync(settingsSrc) && !existsSync(paths.settingsPath)) {
    try {
      copyFileSafe(settingsSrc, paths.settingsPath)
      result.copied.push({
        from: settingsSrc,
        to: paths.settingsPath,
        kind: 'tree-file'
      })
      result.actions.push(`settings: from ${root}`)
    } catch {
      /* ignore */
    }
  }
  // media
  const mediaSrc = join(root, 'media')
  if (isNonEmptyDir(mediaSrc)) {
    const before = result.copied.length
    copyTree(mediaSrc, paths.mediaRoot, result.copied)
    if (result.copied.length > before) {
      result.actions.push(`media: merged from ${mediaSrc}`)
    }
  }
  // logs / cache / exports (optional)
  for (const sub of ['logs', 'cache', 'exports'] as const) {
    const src = join(root, sub)
    const dest =
      sub === 'logs'
        ? paths.logsDir
        : sub === 'cache'
          ? paths.cacheDir
          : paths.exportsDir
    if (isNonEmptyDir(src) && !isNonEmptyDir(dest)) {
      copyTree(src, dest, result.copied)
      result.actions.push(`${sub}: from ${src}`)
    }
  }
}

/** Read marker for diagnostics */
export function readMigrationMarker(
  dataRoot: string
): Record<string, unknown> | null {
  const p = join(dataRoot, MARKER)
  try {
    if (!existsSync(p)) return null
    return JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>
  } catch {
    return null
  }
}

export { MARKER as MIGRATION_MARKER_FILE, basename }
