/**
 * CLI config: flags > env > ~/.config/instant-drama-magician/cli-config.json
 * (legacy ~/.config/idm/config.json still loaded if present)
 *
 * Data dir aligns with desktop appPaths (OS home conventions).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { CliConfigFile, CliGlobalOptions } from './types'
import {
  APP_ID,
  resolveAppPaths,
  resolveOsAppDataBase
} from '../domain/appPaths'

export function defaultConfigPath(): string {
  const base = resolveOsAppDataBase()
  // Prefer app-aligned config; fall back to legacy idm path for reads via loadConfigFile
  return join(base, APP_ID, 'cli-config.json')
}

export function legacyConfigPath(): string {
  const base = resolveOsAppDataBase()
  return join(base, 'idm', 'config.json')
}

/** Same data root as Electron for the active profile (default unless IDM_PROFILE=dev). */
export function defaultDataDir(): string {
  return resolveAppPaths({
    envDataDir: process.env.IDM_DATA_DIR,
    profile: process.env.IDM_PROFILE || 'default',
    isDevRuntime: false
  }).dataRoot
}

export function loadConfigFile(path = defaultConfigPath()): CliConfigFile {
  try {
    const tryPaths = [path]
    if (path === defaultConfigPath()) tryPaths.push(legacyConfigPath())
    for (const p of tryPaths) {
      if (!existsSync(p)) continue
      const raw = readFileSync(p, 'utf8')
      return JSON.parse(raw) as CliConfigFile
    }
    return {}
  } catch {
    return {}
  }
}

export function saveConfigFile(
  partial: CliConfigFile,
  path = defaultConfigPath()
): CliConfigFile {
  const cur = loadConfigFile(path)
  const next = { ...cur, ...partial }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(next, null, 2) + '\n', 'utf8')
  return next
}

export function resolveGlobals(
  flags: Partial<CliGlobalOptions>,
  configPath = defaultConfigPath()
): CliGlobalOptions {
  const file = loadConfigFile(configPath)
  const profileName = flags.profile || process.env.IDM_PROFILE || null
  const profile =
    profileName && file.profiles?.[profileName]
      ? file.profiles[profileName]
      : {}

  const url =
    flags.url ??
    process.env.IDM_URL ??
    process.env.IDM_API_URL ??
    profile.url ??
    file.url ??
    null

  const token =
    flags.token ??
    process.env.IDM_TOKEN ??
    process.env.IDM_AUTH_TOKEN ??
    profile.token ??
    file.token ??
    null

  const dataDir =
    flags.dataDir ??
    process.env.IDM_DATA_DIR ??
    profile.dataDir ??
    file.dataDir ??
    null

  const defaultJson = file.defaultOutput === 'json'

  return {
    json: Boolean(flags.json ?? defaultJson),
    pretty: Boolean(flags.pretty),
    quiet: Boolean(flags.quiet),
    url: url ? String(url).replace(/\/+$/, '') : null,
    token: token ? String(token) : null,
    local: Boolean(flags.local),
    dataDir: dataDir ? String(dataDir) : null,
    profile: profileName,
    yes: Boolean(flags.yes || process.env.IDM_YES === '1'),
    help: Boolean(flags.help)
  }
}
