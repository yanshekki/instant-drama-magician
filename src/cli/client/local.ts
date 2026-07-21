/**
 * Local IdmClient — headless createRuntime (same channels as web server).
 */
import { join, resolve } from 'path'
import { mkdirSync } from 'fs'

/** Exported for residual unit tests. */
export function mkdirNonFatal(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    /* ignore */
  }
}
import { createRuntime, type AppRuntime } from '../../runtime/createRuntime'
import type { IdmClient } from '../types'
import { defaultDataDir } from '../config'
import { resolveAppPaths } from '../../domain/appPaths'
import { migrateAppDataIfNeeded } from '../../application/services/AppDataMigrationService'

export interface LocalClientOptions {
  dataDir?: string | null
  appVersion?: string
}

export async function createLocalClient(
  opts: LocalClientOptions = {}
): Promise<IdmClient & { runtime: AppRuntime }> {
  const dataDir = resolve(opts.dataDir || defaultDataDir())
  const paths = resolveAppPaths({
    dataDir,
    envDataDir: process.env.IDM_DATA_DIR,
    profile: process.env.IDM_PROFILE || 'default'
  })
  for (const d of [
    paths.dataRoot,
    paths.mediaRoot,
    paths.logsDir,
    paths.cacheDir,
    paths.exportsDir
  ]) {
    mkdirNonFatal(d)
  }
  try {
    migrateAppDataIfNeeded({ paths, cwd: process.cwd() })
  } catch {
    /* non-fatal */
  }
  // Always bind this client to the resolved data root DB (ignore .env prisma/dev.db)
  process.env.DATABASE_URL = paths.databaseUrl
  const runtime = createRuntime({
    dataDir: paths.dataRoot,
    databaseUrl: paths.databaseUrl,
    appVersion: opts.appVersion || process.env.npm_package_version || '1.0.0',
    platform: process.platform,
    isPackaged: false
  })

  return {
    mode: 'local',
    runtime,
    invoke: (channel, args = []) => runtime.invoke(channel, args),
    channels: async () => runtime.channels(),
    dispose: () => runtime.dispose(),
    describe: () => ({
      mode: 'local',
      dataDir: runtime.dataDir,
      mediaRoot: runtime.mediaRoot,
      settingsPath: runtime.settingsPath,
      channelCount: runtime.channels().length
    })
  }
}

export function resolveLocalDataDir(explicit?: string | null): string {
  return resolve(explicit || defaultDataDir())
}

export function localDbUrl(dataDir: string): string {
  return `file:${join(resolve(dataDir), 'instant-drama.db')}`
}
