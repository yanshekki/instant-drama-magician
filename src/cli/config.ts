/**
 * CLI config: flags > env > ~/.config/idm/config.json
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { dirname, join } from 'path'
import type { CliConfigFile, CliGlobalOptions } from './types'

export function defaultConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME || join(homedir(), '.config')
  return join(xdg, 'idm', 'config.json')
}

export function defaultDataDir(): string {
  if (process.env.IDM_DATA_DIR) return process.env.IDM_DATA_DIR
  const xdg = process.env.XDG_DATA_HOME || join(homedir(), '.local', 'share')
  return join(xdg, 'idm')
}

export function loadConfigFile(path = defaultConfigPath()): CliConfigFile {
  try {
    if (!existsSync(path)) return {}
    const raw = readFileSync(path, 'utf8')
    return JSON.parse(raw) as CliConfigFile
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
