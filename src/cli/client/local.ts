/**
 * Local IdmClient — headless createRuntime (same channels as web server).
 */
import { join, resolve } from 'path'
import { createRuntime, type AppRuntime } from '../../runtime/createRuntime'
import type { IdmClient } from '../types'
import { defaultDataDir } from '../config'

export interface LocalClientOptions {
  dataDir?: string | null
  appVersion?: string
}

export async function createLocalClient(
  opts: LocalClientOptions = {}
): Promise<IdmClient & { runtime: AppRuntime }> {
  const dataDir = resolve(opts.dataDir || defaultDataDir())
  const runtime = createRuntime({
    dataDir,
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
