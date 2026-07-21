/**
 * Cross-platform app data paths (Electron / CLI / web server).
 *
 * Phase A (Electron-aligned single data root):
 *   Linux:   $XDG_CONFIG_HOME/instant-drama-magician  → ~/.config/instant-drama-magician
 *   macOS:   ~/Library/Application Support/instant-drama-magician
 *   Windows: %APPDATA%\\instant-drama-magician
 *
 * Profile isolation (dev vs default) uses a sibling folder suffix `-dev`,
 * not a separate DB under the repo. Everything lives under one dataRoot:
 *   instant-drama.db, settings.json, media/, logs/, cache/, exports/
 *
 * Override order:
 *   1. explicit dataDir option / --data-dir
 *   2. IDM_DATA_DIR
 *   3. IDM_PROFILE (dev|default|custom) on top of OS base
 *   4. OS default (+ packaged vs dev profile)
 */
import { homedir } from 'os'
import { join, resolve } from 'path'

/** Folder name under OS app-data base (matches package.json name / Electron product). */
export const APP_ID = 'instant-drama-magician'

/** SQLite filename inside data root */
export const DATABASE_FILE = 'instant-drama.db'

export type AppPathPlatform = 'linux' | 'darwin' | 'win32' | string

export type AppPathProfile = 'default' | 'dev' | string

export type ResolveAppPathsOptions = {
  /** Absolute data root override (flags / tests) */
  dataDir?: string | null
  /** process.env.IDM_DATA_DIR */
  envDataDir?: string | null
  /** process.env.IDM_PROFILE — 'default' | 'dev' | custom segment */
  profile?: AppPathProfile | null
  /**
   * When true (Electron !isPackaged), default profile becomes 'dev'
   * unless IDM_PROFILE / profile option is set.
   */
  isDevRuntime?: boolean
  /** Override process.platform */
  platform?: AppPathPlatform
  /** Override os.homedir() */
  home?: string
  /** Override env map (XDG_*, APPDATA, etc.) */
  env?: NodeJS.ProcessEnv
}

export type AppPaths = {
  /** Single root for DB + settings + media + logs + cache + exports */
  dataRoot: string
  profile: AppPathProfile
  databasePath: string
  /** Prisma file: URL */
  databaseUrl: string
  settingsPath: string
  mediaRoot: string
  logsDir: string
  cacheDir: string
  exportsDir: string
  /** True when dataRoot came from explicit override */
  isOverride: boolean
}

function envOf(opts: ResolveAppPathsOptions): NodeJS.ProcessEnv {
  return opts.env ?? process.env
}

function homeOf(opts: ResolveAppPathsOptions): string {
  return opts.home ?? homedir()
}

function platformOf(opts: ResolveAppPathsOptions): AppPathPlatform {
  return opts.platform ?? process.platform
}

/**
 * OS base directory that contains the app folder (without APP_ID).
 * Matches Electron `app.getPath('appData')` semantics for desktop apps.
 */
export function resolveOsAppDataBase(
  opts: Pick<ResolveAppPathsOptions, 'platform' | 'home' | 'env'> = {}
): string {
  const env = envOf(opts)
  const home = homeOf(opts)
  const platform = platformOf(opts)

  if (platform === 'win32') {
    // Electron userData on Windows lives under APPDATA (Roaming)
    const appData = env.APPDATA || join(home, 'AppData', 'Roaming')
    return appData
  }
  if (platform === 'darwin') {
    return join(home, 'Library', 'Application Support')
  }
  // Linux / BSD — Electron uses XDG_CONFIG_HOME (~/.config)
  const xdgConfig = env.XDG_CONFIG_HOME || join(home, '.config')
  return xdgConfig
}

/** Folder name under OS base for a profile. */
export function appFolderName(profile: AppPathProfile = 'default'): string {
  const p = (profile || 'default').trim() || 'default'
  if (p === 'default') return APP_ID
  if (p === 'dev') return `${APP_ID}-dev`
  // custom profiles: instant-drama-magician-<slug>
  const slug = p.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
  return slug ? `${APP_ID}-${slug}` : APP_ID
}

export function resolveProfile(opts: ResolveAppPathsOptions = {}): AppPathProfile {
  const env = envOf(opts)
  const raw =
    opts.profile ??
    env.IDM_PROFILE ??
    (opts.isDevRuntime ? 'dev' : 'default')
  const p = String(raw || 'default').trim() || 'default'
  return p
}

/**
 * Resolve the single data root used by desktop, CLI, and server.
 */
export function resolveDataRoot(opts: ResolveAppPathsOptions = {}): {
  dataRoot: string
  profile: AppPathProfile
  isOverride: boolean
} {
  const env = envOf(opts)
  const explicit =
    (opts.dataDir && String(opts.dataDir).trim()) ||
    (opts.envDataDir && String(opts.envDataDir).trim()) ||
    (env.IDM_DATA_DIR && String(env.IDM_DATA_DIR).trim()) ||
    ''

  if (explicit) {
    return {
      dataRoot: resolve(explicit),
      profile: resolveProfile(opts),
      isOverride: true
    }
  }

  const profile = resolveProfile(opts)
  const base = resolveOsAppDataBase(opts)
  return {
    dataRoot: join(base, appFolderName(profile)),
    profile,
    isOverride: false
  }
}

/** Full path map for one data root. */
export function resolveAppPaths(opts: ResolveAppPathsOptions = {}): AppPaths {
  const { dataRoot, profile, isOverride } = resolveDataRoot(opts)
  const databasePath = join(dataRoot, DATABASE_FILE)
  return {
    dataRoot,
    profile,
    databasePath,
    databaseUrl: pathToFileUrl(databasePath),
    settingsPath: join(dataRoot, 'settings.json'),
    mediaRoot: join(dataRoot, 'media'),
    logsDir: join(dataRoot, 'logs'),
    cacheDir: join(dataRoot, 'cache'),
    exportsDir: join(dataRoot, 'exports'),
    isOverride
  }
}

/** Prisma-compatible file URL (absolute path). */
export function pathToFileUrl(absPath: string): string {
  const resolved = resolve(absPath)
  // Windows: file:C:\... is accepted by Prisma; prefer file:///C:/...
  if (process.platform === 'win32' || /^[A-Za-z]:[\\/]/.test(resolved)) {
    const normalized = resolved.replace(/\\/g, '/')
    return `file:///${normalized}`
  }
  return `file:${resolved}`
}

/**
 * Legacy locations we may migrate from (never delete automatically).
 * Paths are absolute for the current machine.
 */
export function legacyDataCandidates(
  opts: ResolveAppPathsOptions & { cwd?: string } = {}
): {
  /** Old Electron/CLI folders that may hold a full tree */
  roots: string[]
  /** Old repo-relative SQLite files (DB only) */
  databases: string[]
} {
  const home = homeOf(opts)
  const env = envOf(opts)
  const cwd = opts.cwd ?? process.cwd()
  const xdgConfig = env.XDG_CONFIG_HOME || join(home, '.config')
  const xdgData = env.XDG_DATA_HOME || join(home, '.local', 'share')
  const appData = env.APPDATA || join(home, 'AppData', 'Roaming')
  const macAs = join(home, 'Library', 'Application Support')

  const roots = [
    // Previous CLI short name
    join(xdgData, 'idm'),
    // Explicit common config names (if different profile later)
    join(xdgConfig, APP_ID),
    join(xdgConfig, `${APP_ID}-dev`),
    join(appData, APP_ID),
    join(appData, `${APP_ID}-dev`),
    join(macAs, APP_ID),
    join(macAs, `${APP_ID}-dev`)
  ]

  const databases = [
    join(cwd, 'prisma', 'dev.db'),
    join(cwd, 'data', DATABASE_FILE)
  ]

  return { roots: [...new Set(roots)], databases: [...new Set(databases)] }
}
